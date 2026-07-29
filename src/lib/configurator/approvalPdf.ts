import type {
  Artwork,
  ArtworkSide,
  GarmentColour,
  NeckLabel,
} from "@/lib/configurator/types/configurator";
import { formatInr } from "@/lib/configurator/pricing";

export interface ApprovalPdfItem {
  id: string;
  productName: string;
  previewImage: string;
  colour: GarmentColour;
  artwork: Artwork;
  neckLabel?: NeckLabel;
  sizeQuantities: Record<string, number>;
  unitPrice: number;
}

export interface ApprovalPdfTotals {
  subtotal: number;
  volumeDiscount: number;
  gst: number;
  total: number;
  reservationFee: number;
  balanceDue: number;
}

export interface GenerateApprovalPdfOptions {
  projectReference: string;
  documentTitle: string;
  items: ApprovalPdfItem[];
  totals: ApprovalPdfTotals;
  companyName?: string;
  contactName?: string;
  deliveryLabel?: string;
  previewDataUrls?: Record<string, string | undefined>;
  filename?: string;
}

type PdfImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

type PageImage = {
  image: PdfImage;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PdfPage = {
  commands: string[];
  images: PageImage[];
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 42;
const encoder = new TextEncoder();

const TECHNIQUE_LABELS: Record<string, string> = {
  screen_print: "Screen print",
  dtg: "Direct-to-garment print",
  dtf: "Direct-to-film print",
  reflective_heat_transfer: "Reflective heat transfer",
  puff_print: "Puff print",
  embroidery: "Embroidery",
};

function sanitizePdfText(value: string): string {
  return value
    .replace(/₹/g, "Rs. ")
    .replace(/[–—]/g, "-")
    .replace(/×/g, "x")
    .replace(/…/g, "...")
    .replace(/[^\x00-\x7F]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function pdfText(
  text: string,
  x: number,
  y: number,
  size = 10,
  bold = false,
  colour: [number, number, number] = [0.07, 0.07, 0.07]
): string {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf ${colour.join(" ")} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${sanitizePdfText(text)}) Tj ET`;
}

function line(x1: number, y1: number, x2: number, y2: number, width = 0.7): string {
  return `0.88 0.88 0.88 RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`;
}

function roundedRect(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: [number, number, number],
  stroke: [number, number, number] = [0.88, 0.88, 0.88]
): string {
  const radius = 8;
  const k = 0.55228475;
  const c = radius * k;
  return [
    `${fill.join(" ")} rg ${stroke.join(" ")} RG 0.8 w`,
    `${x + radius} ${y} m`,
    `${x + width - radius} ${y} l`,
    `${x + width - radius + c} ${y} ${x + width} ${y + radius - c} ${x + width} ${y + radius} c`,
    `${x + width} ${y + height - radius} l`,
    `${x + width} ${y + height - radius + c} ${x + width - radius + c} ${y + height} ${x + width - radius} ${y + height} c`,
    `${x + radius} ${y + height} l`,
    `${x + radius - c} ${y + height} ${x} ${y + height - radius + c} ${x} ${y + height - radius} c`,
    `${x} ${y + radius} l`,
    `${x} ${y + radius - c} ${x + radius - c} ${y} ${x + radius} ${y} c`,
    "B",
  ].join("\n");
}

function wrapText(text: string, maxCharacters: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharacters && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function addWrappedText(
  commands: string[],
  text: string,
  x: number,
  y: number,
  maxCharacters: number,
  size = 9,
  lineHeight = 13,
  bold = false,
  colour?: [number, number, number]
): number {
  const lines = wrapText(text, maxCharacters);
  lines.forEach((entry, index) => {
    commands.push(pdfText(entry, x, y - index * lineHeight, size, bold, colour));
  });
  return y - lines.length * lineHeight;
}

function totalUnits(item: ApprovalPdfItem): number {
  return Object.values(item.sizeQuantities).reduce((sum, quantity) => sum + quantity, 0);
}

function artworkLine(side: "Front" | "Back", artwork?: ArtworkSide): string {
  if (!artwork?.fileUrl && !artwork?.fileId) {
    return `${side}: No artwork selected`;
  }
  const technique = artwork.technique
    ? TECHNIQUE_LABELS[artwork.technique] ?? artwork.technique.replaceAll("_", " ")
    : "Technique to be recommended";
  const review = artwork.vectorized ? "production file available" : "file preparation review required";
  return `${side}: ${technique}, ${artwork.width} x ${artwork.height} cm, ${artwork.fromNeck} cm below neck (${review})`;
}

function neckLabelLine(label?: NeckLabel): string {
  if (!label?.fileUrl && !label?.fileId) {
    return "Custom label: Skipped / standard label retained";
  }
  return `Custom label: ${label.dimensions?.replace("x", " x ")} mm, ${label.position.replaceAll("_", " ")}${label.stitch ? `, ${label.stitch.replaceAll("_", " ")} stitch` : ""}`;
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read image"));
    reader.readAsDataURL(blob);
  });
}

async function sourceToJpeg(source?: string): Promise<PdfImage | undefined> {
  if (!source) return undefined;
  try {
    let imageSource = source;
    if (!source.startsWith("data:")) {
      const response = await fetch(source);
      if (!response.ok) return undefined;
      imageSource = await readBlobAsDataUrl(await response.blob());
    }

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Unable to load preview image"));
      element.src = imageSource;
    });

    const naturalWidth = Math.max(1, image.naturalWidth || image.width);
    const naturalHeight = Math.max(1, image.naturalHeight || image.height);
    const scale = Math.min(1, 1200 / Math.max(naturalWidth, naturalHeight));
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    context.fillStyle = "#f7f7f7";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) return undefined;
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
  } catch {
    return undefined;
  }
}

function fitImage(image: PdfImage, boxWidth: number, boxHeight: number): { width: number; height: number } {
  const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
  return { width: image.width * scale, height: image.height * scale };
}

function addHeader(page: PdfPage, title: string, reference: string, subtitle?: string): void {
  page.commands.push("0.06 0.38 0.39 rg 0 802 595 40 re f");
  page.commands.push(pdfText("GARMOPS", MARGIN, 817, 13, true, [1, 1, 1]));
  page.commands.push(pdfText(title, MARGIN, 766, 23, true));
  page.commands.push(pdfText(`Project ${reference}`, MARGIN, 744, 9, false, [0.35, 0.35, 0.35]));
  if (subtitle) page.commands.push(pdfText(subtitle, 553 - subtitle.length * 4.4, 744, 8, false, [0.35, 0.35, 0.35]));
}

function buildOverviewPage(
  options: GenerateApprovalPdfOptions,
  previewImages: Record<string, PdfImage | undefined>,
  generatedLabel: string,
  snapshotId: string,
  validUntilLabel: string
): PdfPage {
  const page: PdfPage = { commands: [], images: [] };
  addHeader(page, options.documentTitle, options.projectReference, `Snapshot ${snapshotId}`);

  page.commands.push(roundedRect(MARGIN, 666, 511, 58, [0.965, 0.985, 0.985], [0.75, 0.88, 0.88]));
  page.commands.push(pdfText("Prepared for", 56, 704, 8, true, [0.35, 0.35, 0.35]));
  page.commands.push(pdfText(options.companyName || "Internal company approval", 56, 686, 13, true));
  page.commands.push(pdfText(`Generated ${generatedLabel}`, 340, 706, 8, true, [0.35, 0.35, 0.35]));
  page.commands.push(pdfText(options.deliveryLabel ? `Target delivery date: ${options.deliveryLabel}` : "Target delivery date: To be selected", 340, 689, 9, false));
  page.commands.push(pdfText(`Estimate valid until ${validUntilLabel}`, 340, 674, 7.5, false, [0.35, 0.35, 0.35]));

  page.commands.push(pdfText("Configured products", MARGIN, 640, 13, true));
  const cardY = 488;
  options.items.slice(0, 3).forEach((item, index) => {
    const x = MARGIN + index * 174;
    page.commands.push(roundedRect(x, cardY, 163, 136, [0.985, 0.985, 0.985]));
    const preview = previewImages[item.id];
    if (preview) {
      const fitted = fitImage(preview, 76, 92);
      page.images.push({
        image: preview,
        x: x + (82 - fitted.width) / 2 + 4,
        y: cardY + 35 + (92 - fitted.height) / 2,
        width: fitted.width,
        height: fitted.height,
      });
    }
    page.commands.push(pdfText(item.productName.slice(0, 28), x + 86, cardY + 105, 9, true));
    page.commands.push(pdfText(item.colour.name.slice(0, 25), x + 86, cardY + 88, 8, false, [0.35, 0.35, 0.35]));
    page.commands.push(pdfText(`${totalUnits(item)} units`, x + 86, cardY + 71, 8, false));
    page.commands.push(pdfText(`${formatInr(item.unitPrice)}/unit`, x + 86, cardY + 54, 8, true, [0.06, 0.38, 0.39]));
    page.commands.push(pdfText("See specification page", x + 12, cardY + 16, 7.5, false, [0.35, 0.35, 0.35]));
  });
  if (options.items.length > 3) {
    page.commands.push(pdfText(`+ ${options.items.length - 3} additional configured product(s)`, MARGIN, 470, 9, false, [0.35, 0.35, 0.35]));
  }

  page.commands.push(pdfText("Commercial estimate", MARGIN, 438, 13, true));
  const rows: Array<[string, string, boolean?]> = [
    ["Merchandise subtotal", formatInr(options.totals.subtotal)],
    ["Volume discount", options.totals.volumeDiscount ? `-${formatInr(options.totals.volumeDiscount)}` : formatInr(0)],
    ["GST", formatInr(options.totals.gst)],
    ["Estimated order total", formatInr(options.totals.total), true],
  ];
  let rowY = 410;
  rows.forEach(([label, value, bold]) => {
    page.commands.push(pdfText(label, MARGIN, rowY, 9.5, Boolean(bold)));
    page.commands.push(pdfText(value, 470, rowY, 9.5, Boolean(bold)));
    page.commands.push(line(MARGIN, rowY - 9, 553, rowY - 9));
    rowY -= 28;
  });

  page.commands.push(roundedRect(MARGIN, 230, 511, 72, [0.965, 0.985, 0.985], [0.75, 0.88, 0.88]));
  page.commands.push(pdfText("DUE TODAY TO RESERVE SLOT", 58, 278, 8, true, [0.06, 0.38, 0.39]));
  page.commands.push(pdfText(formatInr(options.totals.reservationFee), 58, 250, 22, true, [0.06, 0.38, 0.39]));
  page.commands.push(pdfText(`Estimated balance later: ${formatInr(options.totals.balanceDue)}`, 310, 258, 9, true));
  page.commands.push(pdfText("The reservation fee is credited in full against the final invoice.", 310, 242, 7.5, false, [0.35, 0.35, 0.35]));

  let disclaimerY = 196;
  disclaimerY = addWrappedText(
    page.commands,
    "This document is a dated configuration and approval snapshot. Final pricing, shipping, production technique and delivery feasibility are confirmed after Garmops reviews the artwork and order requirements.",
    MARGIN,
    disclaimerY,
    105,
    8.5,
    12,
    false,
    [0.35, 0.35, 0.35]
  );
  addWrappedText(
    page.commands,
    "Changes made in the configurator after this PDF was generated are not reflected in this document.",
    MARGIN,
    disclaimerY - 5,
    105,
    8.5,
    12,
    true,
    [0.35, 0.35, 0.35]
  );
  page.commands.push(pdfText(`Snapshot ${snapshotId}  |  Reference ${options.projectReference}`, MARGIN, 42, 7.5, false, [0.45, 0.45, 0.45]));
  return page;
}

function buildItemPage(
  item: ApprovalPdfItem,
  index: number,
  totalItems: number,
  reference: string,
  preview?: PdfImage
): PdfPage {
  const page: PdfPage = { commands: [], images: [] };
  addHeader(page, item.productName, reference, `Product ${index + 1} of ${totalItems}`);

  page.commands.push(roundedRect(MARGIN, 444, 236, 270, [0.975, 0.975, 0.975]));
  if (preview) {
    const fitted = fitImage(preview, 206, 236);
    page.images.push({
      image: preview,
      x: MARGIN + 15 + (206 - fitted.width) / 2,
      y: 459 + (236 - fitted.height) / 2,
      width: fitted.width,
      height: fitted.height,
    });
  } else {
    page.commands.push(pdfText("Preview unavailable", 106, 580, 10, false, [0.45, 0.45, 0.45]));
  }
  page.commands.push(pdfText("Digital preview: final placement is confirmed during review", MARGIN, 428, 7.5, false, [0.4, 0.4, 0.4]));

  const detailX = 304;
  page.commands.push(pdfText("Product specification", detailX, 700, 12, true));
  const details = [
    ["Product", item.productName],
    ["Garment colour", `${item.colour.name} (${item.colour.hex.toUpperCase()})`],
    ["Colour route", item.colour.type === "custom_dye" ? "Custom dye: feasibility review required" : "Ready-stock / signature colour"],
    ["Total quantity", `${totalUnits(item)} units`],
    ["Estimated unit price", formatInr(item.unitPrice)],
  ];
  let y = 674;
  details.forEach(([label, value]) => {
    page.commands.push(pdfText(label, detailX, y, 7.5, true, [0.4, 0.4, 0.4]));
    y = addWrappedText(page.commands, value, detailX, y - 14, 43, 9, 12, false) - 9;
  });

  page.commands.push(pdfText("Size allocation", MARGIN, 390, 12, true));
  const sizes = Object.entries(item.sizeQuantities).filter(([, quantity]) => quantity > 0);
  const cellWidth = Math.min(78, 511 / Math.max(1, sizes.length));
  sizes.forEach(([size, quantity], sizeIndex) => {
    const x = MARGIN + sizeIndex * cellWidth;
    page.commands.push(roundedRect(x, 338, cellWidth - 5, 38, [0.985, 0.985, 0.985]));
    page.commands.push(pdfText(size, x + 8, 360, 8, true));
    page.commands.push(pdfText(String(quantity), x + 8, 345, 9, false));
  });
  page.commands.push(pdfText("A recommended company-order mix may have been applied automatically; quantities shown here are the approval snapshot.", MARGIN, 322, 7.5, false, [0.4, 0.4, 0.4]));

  page.commands.push(pdfText("Branding specification", MARGIN, 286, 12, true));
  const brandingLines = [
    artworkLine("Front", item.artwork.front),
    artworkLine("Back", item.artwork.back),
    neckLabelLine(item.neckLabel),
  ];
  let brandingY = 262;
  brandingLines.forEach((entry) => {
    page.commands.push("0.06 0.38 0.39 rg 44 " + (brandingY + 2) + " 4 4 re f");
    brandingY = addWrappedText(page.commands, entry, 56, brandingY, 94, 8.5, 12, false) - 8;
  });

  page.commands.push(roundedRect(MARGIN, 82, 511, 72, [0.985, 0.985, 0.985]));
  page.commands.push(pdfText("PRODUCTION REVIEW STATUS", 56, 132, 8, true, [0.4, 0.4, 0.4]));
  const needsFileReview = [item.artwork.front, item.artwork.back].some(
    (side) => side?.fileUrl && !side.vectorized
  );
  page.commands.push(pdfText(
    needsFileReview ? "Artwork file preparation review required; buyer may continue" : "Ready for Garmops production review",
    56,
    110,
    11,
    true,
    [0.06, 0.38, 0.39]
  ));
  page.commands.push(pdfText("Technique, colour accuracy, print size and placement remain subject to technical approval.", 56, 94, 7.5, false, [0.4, 0.4, 0.4]));
  page.commands.push(pdfText(`Reference ${reference}  |  Product ${index + 1}`, MARGIN, 42, 7.5, false, [0.45, 0.45, 0.45]));
  return page;
}

function buildApprovalPage(
  options: GenerateApprovalPdfOptions,
  generatedLabel: string,
  snapshotId: string
): PdfPage {
  const page: PdfPage = { commands: [], images: [] };
  addHeader(page, "Internal Approval", options.projectReference, generatedLabel);

  page.commands.push(pdfText("Recommended approval statement", MARGIN, 704, 13, true));
  const statement = `I approve the merchandise configuration and estimated commercial value shown in this document for ${options.companyName || "our company"}. I understand that final pricing, shipping and production feasibility will be confirmed by Garmops before production begins.`;
  addWrappedText(page.commands, statement, MARGIN, 678, 105, 10, 15, false, [0.25, 0.25, 0.25]);

  page.commands.push(roundedRect(MARGIN, 470, 511, 120, [0.985, 0.985, 0.985]));
  page.commands.push(pdfText("Approval summary", 58, 566, 10, true));
  page.commands.push(pdfText(`Configured products: ${options.items.length}`, 58, 542, 9));
  page.commands.push(pdfText(`Total units: ${options.items.reduce((sum, item) => sum + totalUnits(item), 0)}`, 58, 522, 9));
  page.commands.push(pdfText(`Estimated order total: ${formatInr(options.totals.total)}`, 58, 502, 9, true));
  page.commands.push(pdfText(`Reservation due today: ${formatInr(options.totals.reservationFee)}`, 310, 542, 9, true, [0.06, 0.38, 0.39]));
  page.commands.push(pdfText(`Target delivery date: ${options.deliveryLabel || "To be confirmed"}`, 310, 522, 9));
  page.commands.push(pdfText(`Project contact: ${options.contactName || "Not provided"}`, 310, 502, 9));

  page.commands.push(pdfText("Manager / approver name", MARGIN, 414, 9, true));
  page.commands.push(line(MARGIN, 376, 280, 376));
  page.commands.push(pdfText("Department / designation", 315, 414, 9, true));
  page.commands.push(line(315, 376, 553, 376));
  page.commands.push(pdfText("Signature", MARGIN, 320, 9, true));
  page.commands.push(line(MARGIN, 260, 280, 260));
  page.commands.push(pdfText("Date", 315, 320, 9, true));
  page.commands.push(line(315, 260, 553, 260));
  page.commands.push(pdfText("Comments / conditions", MARGIN, 206, 9, true));
  page.commands.push(line(MARGIN, 166, 553, 166));
  page.commands.push(line(MARGIN, 126, 553, 126));

  addWrappedText(
    page.commands,
    "This approval page supports internal decision-making and does not itself start production. Production begins only after Garmops technical approval and the agreed commercial terms.",
    MARGIN,
    88,
    108,
    8,
    11,
    false,
    [0.4, 0.4, 0.4]
  );
  page.commands.push(pdfText(`Reference ${options.projectReference}  |  Snapshot ${snapshotId}`, MARGIN, 42, 7.5, false, [0.45, 0.45, 0.45]));
  return page;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  return result;
}

function buildPdf(pages: PdfPage[]): Uint8Array {
  const objects: Array<Uint8Array | undefined> = [undefined];
  const reserve = () => {
    objects.push(undefined);
    return objects.length - 1;
  };
  const setObject = (id: number, body: Uint8Array | string) => {
    objects[id] = typeof body === "string" ? encoder.encode(body) : body;
  };
  const addObject = (body: Uint8Array | string) => {
    const id = reserve();
    setObject(id, body);
    return id;
  };
  const streamObject = (dictionary: string, data: Uint8Array) =>
    concatBytes([
      encoder.encode(`<< ${dictionary} /Length ${data.length} >>\nstream\n`),
      data,
      encoder.encode("\nendstream"),
    ]);

  const catalogId = reserve();
  const pagesId = reserve();
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageIds: number[] = [];
  pages.forEach((page) => {
    const imageEntries = page.images.map((entry, imageIndex) => ({
      ...entry,
      name: `Im${imageIndex + 1}`,
      objectId: addObject(
        streamObject(
          `/Type /XObject /Subtype /Image /Width ${entry.image.width} /Height ${entry.image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
          entry.image.bytes
        )
      ),
    }));
    const imageCommands = imageEntries.map(
      (entry) => `q ${entry.width.toFixed(2)} 0 0 ${entry.height.toFixed(2)} ${entry.x.toFixed(2)} ${entry.y.toFixed(2)} cm /${entry.name} Do Q`
    );
    const contentId = addObject(streamObject("", encoder.encode([...page.commands, ...imageCommands].join("\n"))));
    const pageId = reserve();
    const xObjects = imageEntries.length
      ? `/XObject << ${imageEntries.map((entry) => `/${entry.name} ${entry.objectId} 0 R`).join(" ")} >>`
      : "";
    setObject(
      pageId,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> ${xObjects} >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  });

  setObject(pagesId, `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`);
  setObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  const chunks: Uint8Array[] = [encoder.encode("%PDF-1.4\n%GARMOPS\n")];
  const offsets = new Array(objects.length).fill(0);
  let offset = chunks[0].length;
  for (let id = 1; id < objects.length; id += 1) {
    const body = objects[id];
    if (!body) throw new Error(`Missing PDF object ${id}`);
    offsets[id] = offset;
    const objectBytes = concatBytes([
      encoder.encode(`${id} 0 obj\n`),
      body,
      encoder.encode("\nendobj\n"),
    ]);
    chunks.push(objectBytes);
    offset += objectBytes.length;
  }

  const xrefOffset = offset;
  const xrefLines = ["xref", `0 ${objects.length}`, "0000000000 65535 f "];
  for (let id = 1; id < objects.length; id += 1) {
    xrefLines.push(`${String(offsets[id]).padStart(10, "0")} 00000 n `);
  }
  chunks.push(encoder.encode(`${xrefLines.join("\n")}\ntrailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
  return concatBytes(chunks);
}

export async function generateApprovalPdf(options: GenerateApprovalPdfOptions): Promise<void> {
  const generatedAt = new Date();
  const generatedLabel = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(generatedAt);
  const validUntil = new Date(generatedAt);
  validUntil.setDate(validUntil.getDate() + 7);
  const validUntilLabel = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(validUntil);
  const snapshotId = `${generatedAt.getFullYear()}${String(generatedAt.getMonth() + 1).padStart(2, "0")}${String(generatedAt.getDate()).padStart(2, "0")}-${String(generatedAt.getHours()).padStart(2, "0")}${String(generatedAt.getMinutes()).padStart(2, "0")}`;

  const previewImages: Record<string, PdfImage | undefined> = {};
  await Promise.all(
    options.items.map(async (item) => {
      previewImages[item.id] = await sourceToJpeg(
        options.previewDataUrls?.[item.id] || item.previewImage
      );
    })
  );

  const pages: PdfPage[] = [
    buildOverviewPage(options, previewImages, generatedLabel, snapshotId, validUntilLabel),
    ...options.items.map((item, index) =>
      buildItemPage(item, index, options.items.length, options.projectReference, previewImages[item.id])
    ),
    buildApprovalPage(options, generatedLabel, snapshotId),
  ];
  const bytes = buildPdf(pages);
  const pdfBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(pdfBuffer).set(bytes);
  const blob = new Blob([pdfBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = options.filename || `Garmops-Approval-${options.projectReference}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
