import type {
  Artwork,
  ArtworkSide,
  GarmentColour,
  NeckLabel,
} from "@/lib/configurator/types/configurator";
import { formatInr } from "@/lib/configurator/pricing";
import {
  isCustomNeckLabel,
  NECK_LABEL_POSITION_LABELS,
  NECK_LABEL_STITCH_LABELS,
  TOTE_LABEL_POSITION_LABELS,
} from "@/lib/configurator/neckLabel";

export type ApprovalPdfPreviewView = "front" | "back" | "neck";

export interface ApprovalPdfItem {
  id: string;
  productName: string;
  previewImage: string;
  previewLabels?: Partial<Record<ApprovalPdfPreviewView, string>>;
  colour: GarmentColour;
  artwork: Artwork;
  neckLabel?: NeckLabel;
  sizeQuantities: Record<string, number>;
  unitPrice: number;
  gsm?: number;
  material?: string;
  fit?: string;
  isToteProduct?: boolean;
}

export interface ApprovalPdfTotals {
  subtotal: number;
  volumeDiscount: number;
  gst: number;
  total: number;
}

export interface GenerateApprovalPdfOptions {
  projectReference: string;
  documentTitle: string;
  items: ApprovalPdfItem[];
  totals: ApprovalPdfTotals;
  companyName?: string;
  contactName?: string;
  deliveryLabel?: string;
  previewDataUrls?: Record<
    string,
    Partial<Record<ApprovalPdfPreviewView, string | undefined>>
  >;
  includeApprovalPage?: boolean;
  filename?: string;
}

type Rgb = readonly [number, number, number];
type PdfImage = { bytes: Uint8Array; width: number; height: number };
type PageImage = { image: PdfImage; x: number; y: number; width: number; height: number };
type PdfPage = { commands: string[]; images: PageImage[] };
type PdfFont = "sans" | "sans-bold" | "mono" | "mono-bold";
type PreviewImages = Partial<Record<ApprovalPdfPreviewView, PdfImage>>;

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const encoder = new TextEncoder();

const COLOURS = {
  cream: [0.98, 0.973, 0.961],
  creamSoft: [0.953, 0.941, 0.918],
  white: [1, 1, 1],
  studio: [0.957, 0.965, 0.973],
  navy: [0.086, 0.129, 0.169],
  navySoft: [0.114, 0.165, 0.212],
  muted: [0.325, 0.376, 0.42],
  rule: [0.78, 0.804, 0.824],
  ruleSoft: [0.89, 0.898, 0.906],
  blue: [0.114, 0.286, 0.706],
  blueSoft: [0.925, 0.945, 0.992],
  green: [0.102, 0.478, 0.278],
} as const satisfies Record<string, Rgb>;

const TECHNIQUE_LABELS: Record<string, string> = {
  screen_print: "Screen print",
  dtf: "Direct-to-film print",
  reflective_print: "Reflective print",
};

const FONT_RESOURCE: Record<PdfFont, string> = {
  sans: "F1",
  "sans-bold": "F2",
  mono: "F3",
  "mono-bold": "F4",
};

function sanitizePdfText(value: string): string {
  return value
    .replace(/₹/g, "Rs. ")
    .replace(/[–—]/g, "-")
    .replace(/×/g, "x")
    .replace(/…/g, "...")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
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
  font: PdfFont = "sans",
  colour: Rgb = COLOURS.navy,
): string {
  return `BT /${FONT_RESOURCE[font]} ${size} Tf ${colour.join(" ")} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${sanitizePdfText(text)}) Tj ET`;
}

function glyphWidthFactor(character: string, font: PdfFont): number {
  if (font === "mono" || font === "mono-bold") return 0.6;
  if (/\s/.test(character)) return 0.28;
  if (/[ilI1.,:;!'|]/.test(character)) return 0.28;
  if (/[MW@%#&]/.test(character)) return 0.82;
  if (/[A-Z0-9]/.test(character)) return 0.6;
  return 0.51;
}

function textWidth(text: string, size: number, font: PdfFont = "sans"): number {
  return [...text].reduce((sum, character) => sum + glyphWidthFactor(character, font), 0) * size;
}

function rightText(
  text: string,
  right: number,
  y: number,
  size = 10,
  font: PdfFont = "sans",
  colour: Rgb = COLOURS.navy,
): string {
  return pdfText(text, right - textWidth(text, size, font), y, size, font, colour);
}

function fillRect(x: number, y: number, width: number, height: number, fill: Rgb): string {
  return `${fill.join(" ")} rg ${x} ${y} ${width} ${height} re f`;
}

function strokeRect(
  x: number,
  y: number,
  width: number,
  height: number,
  stroke: Rgb = COLOURS.rule,
  lineWidth = 0.75,
): string {
  return `${stroke.join(" ")} RG ${lineWidth} w ${x} ${y} ${width} ${height} re S`;
}

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width = 0.7,
  stroke: Rgb = COLOURS.rule,
): string {
  return `${stroke.join(" ")} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`;
}

function roundedRect(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: Rgb,
  stroke: Rgb = COLOURS.rule,
  radius = 3,
): string {
  const k = 0.55228475;
  const c = radius * k;
  return [
    `${fill.join(" ")} rg ${stroke.join(" ")} RG 0.75 w`,
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

function wrapText(
  text: string,
  maxWidth: number,
  size: number,
  font: PdfFont,
  maxLines = Number.POSITIVE_INFINITY,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, size, font) > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = candidate;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let finalLine = lines.at(-1) ?? "";
    while (finalLine && textWidth(`${finalLine}...`, size, font) > maxWidth) {
      finalLine = finalLine.slice(0, -1);
    }
    lines[lines.length - 1] = `${finalLine.trimEnd()}...`;
  }
  return lines;
}

function addWrappedText(
  commands: string[],
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size = 9,
  lineHeight = 13,
  font: PdfFont = "sans",
  colour: Rgb = COLOURS.navy,
  maxLines?: number,
): number {
  const lines = wrapText(text, maxWidth, size, font, maxLines);
  lines.forEach((entry, index) => {
    commands.push(pdfText(entry, x, y - index * lineHeight, size, font, colour));
  });
  return y - lines.length * lineHeight;
}

function totalUnits(item: ApprovalPdfItem): number {
  return Object.values(item.sizeQuantities).reduce((sum, quantity) => sum + quantity, 0);
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
    const scale = Math.min(1, 1400 / Math.max(naturalWidth, naturalHeight));
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    context.fillStyle = "#F4F6F8";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
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

function createPage(): PdfPage {
  return { commands: [fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLOURS.cream)], images: [] };
}

function addHeader(
  page: PdfPage,
  section: string,
  pageNumber: number,
  reference: string,
  generatedLabel: string,
): void {
  page.commands.push(pdfText("GARMOPS", MARGIN, 800, 15, "sans-bold", COLOURS.navy));
  page.commands.push(rightText(`${section.toUpperCase()} / ${String(pageNumber).padStart(2, "0")}`, PAGE_WIDTH - MARGIN, 800, 8, "mono-bold", COLOURS.blue));
  page.commands.push(line(MARGIN, 780, PAGE_WIDTH - MARGIN, 780, 1.4, COLOURS.blue));
  page.commands.push(pdfText(`PROJECT / ${reference}`, MARGIN, 762, 7.5, "mono", COLOURS.muted));
  page.commands.push(rightText(`GENERATED / ${generatedLabel}`, PAGE_WIDTH - MARGIN, 762, 7.5, "mono", COLOURS.muted));
}

function addFooter(
  page: PdfPage,
  reference: string,
  pageNumber: number,
  pageCount: number,
  snapshotId: string,
): void {
  page.commands.push(line(MARGIN, 57, PAGE_WIDTH - MARGIN, 57, 0.6, COLOURS.rule));
  page.commands.push(pdfText(`SNAPSHOT / ${snapshotId}`, MARGIN, 40, 7, "mono", COLOURS.muted));
  page.commands.push(rightText(`${reference}  /  ${String(pageNumber).padStart(2, "0")} OF ${String(pageCount).padStart(2, "0")}`, PAGE_WIDTH - MARGIN, 40, 7, "mono", COLOURS.muted));
}

function addPreviewGrid(page: PdfPage, x: number, y: number, width: number, height: number): void {
  const spacing = 18;
  for (let gridX = x + spacing; gridX < x + width; gridX += spacing) {
    page.commands.push(line(gridX, y, gridX, y + height, 0.25, COLOURS.ruleSoft));
  }
  for (let gridY = y + spacing; gridY < y + height; gridY += spacing) {
    page.commands.push(line(x, gridY, x + width, gridY, 0.25, COLOURS.ruleSoft));
  }
}

function addPreviewFrame(
  page: PdfPage,
  label: string,
  image: PdfImage | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  page.commands.push(fillRect(x, y, width, height, COLOURS.studio));
  addPreviewGrid(page, x, y, width, height);
  page.commands.push(strokeRect(x, y, width, height, COLOURS.rule));
  page.commands.push(pdfText(label.toUpperCase(), x + 11, y + height - 20, 7.5, "mono-bold", COLOURS.navy));
  page.commands.push(fillRect(x + 11, y + height - 25, 32, 2, COLOURS.blue));
  if (!image) {
    page.commands.push(pdfText("Preview unavailable", x + 11, y + height / 2, 8, "sans", COLOURS.muted));
    return;
  }
  const fitted = fitImage(image, width - 24, height - 48);
  page.images.push({
    image,
    x: x + (width - fitted.width) / 2,
    y: y + 10 + (height - 42 - fitted.height) / 2,
    width: fitted.width,
    height: fitted.height,
  });
}

function hexToRgb(hex: string): Rgb | undefined {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return undefined;
  return [
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255,
  ];
}

function addSummaryCell(
  page: PdfPage,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  detail: string,
  swatch?: string,
): void {
  page.commands.push(roundedRect(x, y, width, 70, COLOURS.white, COLOURS.rule, 3));
  const textX = swatch ? x + 50 : x + 12;
  page.commands.push(pdfText(label.toUpperCase(), textX, y + 50, 7, "mono-bold", COLOURS.muted));
  page.commands.push(pdfText(value, textX, y + 31, 11, "sans-bold", COLOURS.navy));
  page.commands.push(pdfText(detail, textX, y + 15, 7, "mono", COLOURS.muted));
  if (swatch) {
    page.commands.push(roundedRect(x + 12, y + 16, 28, 38, hexToRgb(swatch) ?? COLOURS.studio, COLOURS.rule, 2));
  }
}

function totalActiveSizes(item: ApprovalPdfItem): number {
  return Object.values(item.sizeQuantities).filter((quantity) => quantity > 0).length;
}

function itemDescriptor(item: ApprovalPdfItem): string {
  return [item.gsm ? `${item.gsm} GSM` : undefined, item.material, item.fit]
    .filter(Boolean)
    .join("  /  ") || "CUSTOM GARMENT CONFIGURATION";
}

function buildDesignPage(
  options: GenerateApprovalPdfOptions,
  item: ApprovalPdfItem,
  itemIndex: number,
  previews: PreviewImages,
  generatedLabel: string,
  snapshotId: string,
  pageNumber: number,
  pageCount: number,
): PdfPage {
  const page = createPage();
  addHeader(page, "Design specification", pageNumber, options.projectReference, generatedLabel);
  page.commands.push(pdfText(item.productName, MARGIN, 720, 25, "sans-bold", COLOURS.navy));
  page.commands.push(pdfText(itemDescriptor(item).toUpperCase(), MARGIN, 697, 8, "mono-bold", COLOURS.muted));
  const productLabel = options.items.length > 1 ? `PRODUCT ${itemIndex + 1} / ${options.items.length}` : "DESIGN SNAPSHOT";
  page.commands.push(roundedRect(420, 704, 133, 25, COLOURS.blueSoft, COLOURS.blue, 3));
  page.commands.push(rightText(productLabel, 542, 713, 7, "mono-bold", COLOURS.blue));

  addPreviewFrame(page, item.previewLabels?.front ?? "Front", previews.front, MARGIN, 315, 322, 350);
  addPreviewFrame(page, item.previewLabels?.back ?? "Back", previews.back, 376, 493, 177, 172);
  addPreviewFrame(page, item.previewLabels?.neck ?? (item.isToteProduct ? "Label" : "Neck"), previews.neck, 376, 315, 177, 166);

  addSummaryCell(page, MARGIN, 218, 160, "Garment colour", item.colour.name, `${item.colour.hex.toUpperCase()} / ${item.colour.type === "custom_dye" ? "CUSTOM DYE" : "SIGNATURE"}`, item.colour.hex);
  const activeSizes = totalActiveSizes(item);
  addSummaryCell(page, 216, 218, 160, "Order quantity", `${totalUnits(item)} units`, `${activeSizes} ACTIVE SIZE${activeSizes === 1 ? "" : "S"}`);
  addSummaryCell(page, 390, 218, 163, "Estimated total", formatInr(options.totals.total), "INCLUDING GST");

  page.commands.push(fillRect(MARGIN, 175, 4, 4, COLOURS.blue));
  addWrappedText(page.commands, "This document is a dated design snapshot. Final colour, placement and production feasibility are confirmed during technical review.", 56, 179, 485, 8.5, 12, "sans", COLOURS.muted, 2);
  addFooter(page, options.projectReference, pageNumber, pageCount, snapshotId);
  return page;
}

function artworkStatus(artwork?: ArtworkSide): { label: string; colour: Rgb } {
  if (!artwork?.fileUrl && !artwork?.fileId) return { label: "NOT ADDED", colour: COLOURS.muted };
  if (!artwork.vectorized || artwork.processingStatus === "needs_review") return { label: "FILE REVIEW", colour: COLOURS.blue };
  return { label: "READY", colour: COLOURS.green };
}

function artworkRows(artwork?: ArtworkSide): Array<[string, string]> {
  if (!artwork?.fileUrl && !artwork?.fileId) {
    return [["Artwork", "Optional / not selected"], ["Production", "No print on this side"]];
  }
  return [
    ["File", artwork.fileName || "Uploaded artwork"],
    ["Technique", artwork.technique ? TECHNIQUE_LABELS[artwork.technique] ?? "Print technique" : "To be confirmed"],
    ["Placement", (artwork.placementPreset || "Custom placement").replaceAll("-", " ")],
    ["Dimensions", `${artwork.width} x ${artwork.height} cm`],
    ["From neck", `${artwork.fromNeck} cm`],
    ["From centre", `${artwork.fromCenter > 0 ? "+" : ""}${artwork.fromCenter} cm`],
  ];
}

function addArtworkCard(
  page: PdfPage,
  side: "Front" | "Back",
  artwork: ArtworkSide | undefined,
  x: number,
  y: number,
  width: number,
): void {
  const height = 184;
  const status = artworkStatus(artwork);
  page.commands.push(roundedRect(x, y, width, height, COLOURS.white, COLOURS.rule, 3));
  page.commands.push(pdfText(`${side.toUpperCase()} / ARTWORK`, x + 13, y + height - 24, 8, "mono-bold", COLOURS.navy));
  page.commands.push(rightText(status.label, x + width - 13, y + height - 24, 7, "mono-bold", status.colour));
  page.commands.push(line(x + 13, y + height - 35, x + width - 13, y + height - 35, 0.6, COLOURS.rule));
  let rowY = y + height - 55;
  for (const [label, value] of artworkRows(artwork)) {
    page.commands.push(pdfText(label.toUpperCase(), x + 13, rowY, 6.7, "mono-bold", COLOURS.muted));
    const lines = wrapText(value, width - 97, 8.2, "sans", 2);
    lines.forEach((entry, lineIndex) => page.commands.push(pdfText(entry, x + 82, rowY - lineIndex * 10, 8.2, "sans", COLOURS.navy)));
    rowY -= Math.max(20, lines.length * 10 + 7);
  }
}

function neckLabelRows(item: ApprovalPdfItem): Array<[string, string]> {
  const label = item.neckLabel;
  if (!label || !isCustomNeckLabel(label)) {
    return [["Label type", item.isToteProduct ? "Standard Garmops bag label" : "Standard size label"], ["Status", "Included"]];
  }
  const positionLabels = item.isToteProduct ? TOTE_LABEL_POSITION_LABELS : NECK_LABEL_POSITION_LABELS;
  return [
    ["Label type", "Custom label"],
    ["File", label.fileName || "Uploaded label artwork"],
    ["Dimensions", `${label.dimensions.replace("x", " x ")} mm`],
    ["Placement", positionLabels[label.position]],
    ["Stitch", label.stitch ? NECK_LABEL_STITCH_LABELS[label.stitch] : "To be confirmed"],
  ];
}

function addLabelPanel(page: PdfPage, item: ApprovalPdfItem): void {
  const x = MARGIN;
  const y = 318;
  page.commands.push(roundedRect(x, y, CONTENT_WIDTH, 84, COLOURS.white, COLOURS.rule, 3));
  page.commands.push(pdfText(`${item.isToteProduct ? "BAG" : "NECK"} LABEL / SPECIFICATION`, x + 13, y + 59, 8, "mono-bold", COLOURS.navy));
  const rows = neckLabelRows(item);
  const cellWidth = (CONTENT_WIDTH - 26) / rows.length;
  rows.forEach(([label, value], index) => {
    const cellX = x + 13 + index * cellWidth;
    page.commands.push(pdfText(label.toUpperCase(), cellX, y + 37, 6.5, "mono-bold", COLOURS.muted));
    addWrappedText(page.commands, value, cellX, y + 21, cellWidth - 10, 8, 9, "sans", COLOURS.navy, 2);
  });
}

function addSizeAllocation(page: PdfPage, item: ApprovalPdfItem): void {
  page.commands.push(pdfText("SIZE ALLOCATION", MARGIN, 289, 8, "mono-bold", COLOURS.navy));
  const visibleSizes = Object.entries(item.sizeQuantities).filter(([, quantity]) => quantity > 0).slice(0, 8);
  const cellWidth = CONTENT_WIDTH / Math.max(1, visibleSizes.length);
  visibleSizes.forEach(([size, quantity], index) => {
    const x = MARGIN + index * cellWidth;
    page.commands.push(fillRect(x, 239, cellWidth - 4, 36, index === 0 ? COLOURS.blueSoft : COLOURS.white));
    page.commands.push(strokeRect(x, 239, cellWidth - 4, 36, COLOURS.rule));
    page.commands.push(pdfText(size, x + 9, 260, 7, "mono-bold", COLOURS.muted));
    page.commands.push(rightText(String(quantity), x + cellWidth - 13, 249, 10, "sans-bold", COLOURS.navy));
  });
}

function addCommercialSummary(page: PdfPage, options: GenerateApprovalPdfOptions, item: ApprovalPdfItem): void {
  page.commands.push(pdfText("COMMERCIAL ESTIMATE", MARGIN, 210, 8, "mono-bold", COLOURS.navy));
  const rows: Array<[string, string]> = [
    ["Merchandise subtotal", formatInr(options.totals.subtotal)],
    ["Volume discount", options.totals.volumeDiscount ? `-${formatInr(options.totals.volumeDiscount)}` : formatInr(0)],
    ["GST", formatInr(options.totals.gst)],
  ];
  let rowY = 188;
  rows.forEach(([label, value]) => {
    page.commands.push(pdfText(label, MARGIN, rowY, 8.5, "sans", COLOURS.muted));
    page.commands.push(rightText(value, 345, rowY, 8.5, "mono", COLOURS.navy));
    rowY -= 20;
  });
  page.commands.push(roundedRect(372, 139, 181, 66, COLOURS.blueSoft, COLOURS.blue, 3));
  page.commands.push(pdfText("ESTIMATED TOTAL / INCL. GST", 385, 181, 6.7, "mono-bold", COLOURS.blue));
  page.commands.push(pdfText(formatInr(options.totals.total), 385, 157, 16, "sans-bold", COLOURS.navy));
  page.commands.push(pdfText(`${formatInr(item.unitPrice)} / UNIT`, 385, 144, 6.7, "mono", COLOURS.muted));
}

function buildProductionPage(
  options: GenerateApprovalPdfOptions,
  item: ApprovalPdfItem,
  generatedLabel: string,
  snapshotId: string,
  pageNumber: number,
  pageCount: number,
): PdfPage {
  const page = createPage();
  addHeader(page, "Production details", pageNumber, options.projectReference, generatedLabel);
  page.commands.push(pdfText("Production details", MARGIN, 720, 25, "sans-bold", COLOURS.navy));
  page.commands.push(pdfText("ARTWORK / LABEL / SIZING / COMMERCIAL", MARGIN, 697, 8, "mono-bold", COLOURS.muted));
  page.commands.push(roundedRect(MARGIN, 642, CONTENT_WIDTH, 39, COLOURS.blueSoft, COLOURS.blue, 3));
  page.commands.push(pdfText("READY FOR GARMOPS TECHNICAL REVIEW", 56, 657, 8, "mono-bold", COLOURS.blue));
  page.commands.push(rightText(`${item.productName} / ${item.colour.name}`, 539, 657, 8, "sans-bold", COLOURS.navy));
  page.commands.push(pdfText("ARTWORK SPECIFICATION", MARGIN, 617, 8, "mono-bold", COLOURS.navy));
  addArtworkCard(page, "Front", item.artwork.front, MARGIN, 422, 249);
  addArtworkCard(page, "Back", item.artwork.back, 304, 422, 249);
  addLabelPanel(page, item);
  addSizeAllocation(page, item);
  addCommercialSummary(page, options, item);
  addWrappedText(page.commands, `Delivery: ${options.deliveryLabel || "To be selected"}. Technique, colour accuracy, print size and placement remain subject to technical approval.`, MARGIN, 105, CONTENT_WIDTH, 7.8, 11, "sans", COLOURS.muted, 2);
  addFooter(page, options.projectReference, pageNumber, pageCount, snapshotId);
  return page;
}

function buildApprovalPage(
  options: GenerateApprovalPdfOptions,
  generatedLabel: string,
  snapshotId: string,
  pageNumber: number,
  pageCount: number,
): PdfPage {
  const page = createPage();
  addHeader(page, "Internal approval", pageNumber, options.projectReference, generatedLabel);
  page.commands.push(pdfText("Internal approval", MARGIN, 720, 25, "sans-bold", COLOURS.navy));
  page.commands.push(pdfText("OPTIONAL / COMPANY RECORD", MARGIN, 697, 8, "mono-bold", COLOURS.muted));
  addWrappedText(page.commands, `I approve the merchandise configuration and estimated commercial value shown in this document for ${options.companyName || "our company"}. I understand that production begins only after Garmops technical approval and agreed commercial terms.`, MARGIN, 650, CONTENT_WIDTH, 10, 15, "sans", COLOURS.navySoft, 5);
  page.commands.push(roundedRect(MARGIN, 493, CONTENT_WIDTH, 92, COLOURS.white, COLOURS.rule, 3));
  page.commands.push(pdfText("APPROVAL SUMMARY", 56, 560, 8, "mono-bold", COLOURS.muted));
  page.commands.push(pdfText(`${options.items.length} configured product${options.items.length === 1 ? "" : "s"}`, 56, 536, 10, "sans-bold"));
  page.commands.push(pdfText(`${options.items.reduce((sum, item) => sum + totalUnits(item), 0)} total units`, 56, 516, 9, "sans"));
  page.commands.push(pdfText("ESTIMATED TOTAL / INCL. GST", 330, 560, 7, "mono-bold", COLOURS.blue));
  page.commands.push(pdfText(formatInr(options.totals.total), 330, 531, 18, "sans-bold", COLOURS.navy));
  const fields: Array<[string, number, number, number]> = [
    ["Manager / approver name", MARGIN, 423, 238],
    ["Department / designation", 315, 423, 238],
    ["Signature", MARGIN, 325, 238],
    ["Date", 315, 325, 238],
  ];
  fields.forEach(([label, x, y, width]) => {
    page.commands.push(pdfText(label, x, y, 8, "mono-bold", COLOURS.muted));
    page.commands.push(line(x, y - 38, x + width, y - 38, 0.8, COLOURS.rule));
  });
  page.commands.push(pdfText("Comments / conditions", MARGIN, 225, 8, "mono-bold", COLOURS.muted));
  page.commands.push(line(MARGIN, 184, PAGE_WIDTH - MARGIN, 184, 0.8, COLOURS.rule));
  page.commands.push(line(MARGIN, 144, PAGE_WIDTH - MARGIN, 144, 0.8, COLOURS.rule));
  addFooter(page, options.projectReference, pageNumber, pageCount, snapshotId);
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

function buildPdf(pages: PdfPage[], documentTitle: string): Uint8Array {
  const objects: Array<Uint8Array | undefined> = [undefined];
  const reserve = () => { objects.push(undefined); return objects.length - 1; };
  const setObject = (id: number, body: Uint8Array | string) => { objects[id] = typeof body === "string" ? encoder.encode(body) : body; };
  const addObject = (body: Uint8Array | string) => { const id = reserve(); setObject(id, body); return id; };
  const streamObject = (dictionary: string, data: Uint8Array) => concatBytes([encoder.encode(`<< ${dictionary} /Length ${data.length} >>\nstream\n`), data, encoder.encode("\nendstream")]);

  const catalogId = reserve();
  const pagesId = reserve();
  const infoId = addObject(`<< /Title (${sanitizePdfText(documentTitle)}) /Author (Garmops) /Creator (Garmops Configurator) >>`);
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const fontMonoId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
  const fontMonoBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>");

  const pageIds: number[] = [];
  pages.forEach((page) => {
    const imageEntries = page.images.map((entry, imageIndex) => ({
      ...entry,
      name: `Im${imageIndex + 1}`,
      objectId: addObject(streamObject(`/Type /XObject /Subtype /Image /Width ${entry.image.width} /Height ${entry.image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, entry.image.bytes)),
    }));
    const imageCommands = imageEntries.map((entry) => `q ${entry.width.toFixed(2)} 0 0 ${entry.height.toFixed(2)} ${entry.x.toFixed(2)} ${entry.y.toFixed(2)} cm /${entry.name} Do Q`);
    const contentId = addObject(streamObject("", encoder.encode([...page.commands, ...imageCommands].join("\n"))));
    const pageId = reserve();
    const xObjects = imageEntries.length ? `/XObject << ${imageEntries.map((entry) => `/${entry.name} ${entry.objectId} 0 R`).join(" ")} >>` : "";
    setObject(pageId, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontMonoId} 0 R /F4 ${fontMonoBoldId} 0 R >> ${xObjects} >> /Contents ${contentId} 0 R >>`);
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
    const objectBytes = concatBytes([encoder.encode(`${id} 0 obj\n`), body, encoder.encode("\nendobj\n")]);
    chunks.push(objectBytes);
    offset += objectBytes.length;
  }
  const xrefOffset = offset;
  const xrefLines = ["xref", `0 ${objects.length}`, "0000000000 65535 f "];
  for (let id = 1; id < objects.length; id += 1) xrefLines.push(`${String(offsets[id]).padStart(10, "0")} 00000 n `);
  chunks.push(encoder.encode(`${xrefLines.join("\n")}\ntrailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
  return concatBytes(chunks);
}

function generatedDocumentMetadata(generatedAt: Date): { generatedLabel: string; snapshotId: string } {
  const generatedLabel = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(generatedAt);
  return {
    generatedLabel,
    snapshotId: `${generatedAt.getFullYear()}${String(generatedAt.getMonth() + 1).padStart(2, "0")}${String(generatedAt.getDate()).padStart(2, "0")}-${String(generatedAt.getHours()).padStart(2, "0")}${String(generatedAt.getMinutes()).padStart(2, "0")}`,
  };
}

export async function createApprovalPdfBytes(
  options: GenerateApprovalPdfOptions,
  generatedAt = new Date(),
): Promise<Uint8Array> {
  const { generatedLabel, snapshotId } = generatedDocumentMetadata(generatedAt);
  const previewImages: Record<string, PreviewImages> = {};
  await Promise.all(options.items.map(async (item) => {
    const sources = options.previewDataUrls?.[item.id] ?? {};
    const [front, back, neck] = await Promise.all([
      sourceToJpeg(sources.front || item.previewImage),
      sourceToJpeg(sources.back),
      sourceToJpeg(sources.neck),
    ]);
    previewImages[item.id] = { front, back, neck };
  }));

  const pageCount = options.items.length * 2 + (options.includeApprovalPage ? 1 : 0);
  const pages: PdfPage[] = [];
  options.items.forEach((item, index) => {
    const designPageNumber = index * 2 + 1;
    pages.push(
      buildDesignPage(options, item, index, previewImages[item.id], generatedLabel, snapshotId, designPageNumber, pageCount),
      buildProductionPage(options, item, generatedLabel, snapshotId, designPageNumber + 1, pageCount),
    );
  });
  if (options.includeApprovalPage) pages.push(buildApprovalPage(options, generatedLabel, snapshotId, pageCount, pageCount));
  return buildPdf(pages, options.documentTitle);
}

export async function generateApprovalPdf(options: GenerateApprovalPdfOptions): Promise<void> {
  const bytes = await createApprovalPdfBytes(options);
  const pdfBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(pdfBuffer).set(bytes);
  const blob = new Blob([pdfBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = options.filename || `Garmops-Design-${options.projectReference}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
