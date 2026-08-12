import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

import { amountInWords } from "@/lib/invoices/amountInWords";

type InvoiceLine = {
  description: string;
  quantity: number;
  totalPaise: number;
  hsnCode?: string;
};

type SellerBankDetails = {
  name: string;
  accountNumber: string;
  ifsc: string;
};

export type InvoicePdfInput = {
  number: string;
  issuedAt: string;
  orderNumber?: string | null;
  orderDate?: string | null;
  placeOfSupply?: string | null;
  seller: {
    legalName: string;
    address: string;
    gstin: string;
    state: string;
    bank?: SellerBankDetails;
    msme?: string | null;
  };
  buyer: { name: string; address: string; gstin?: string | null; state?: string | null };
  lines: InvoiceLine[];
  subtotalPaise: number;
  discountPaise: number;
  taxableValuePaise: number;
  taxPaise: number;
  totalPaise: number;
  gstRateBasisPoints: number;
};

const encoder = new TextEncoder();
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LEFT = 42;
const RIGHT = 553;
const TABLE_COLUMNS = [42, 270, 336, 377, 441, 492, 553];
const TABLE_HEADER_HEIGHT = 26;
const NORMAL_PAGE_BOTTOM = 60;
const FINAL_PAGE_TABLE_BOTTOM = 370;
const MAX_ROWS_PER_PAGE = 12;
const INK = "0.10 0.10 0.10";
const MUTED = "0.38 0.38 0.38";
const RULE = "0.72 0.72 0.72";

type PdfObject = Uint8Array;

type LogoImage = {
  width: number;
  height: number;
  rgb: Uint8Array;
  alpha: Uint8Array;
};

type InvoiceRow = InvoiceLine & {
  descriptionLines: string[];
  height: number;
  ratePaise: number;
  gstCell: string;
};

function bytes(...parts: (Uint8Array | string)[]): Uint8Array {
  const encoded = parts.map((part) => (typeof part === "string" ? encoder.encode(part) : part));
  const length = encoded.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of encoded) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function ascii(value: string): Uint8Array {
  return encoder.encode(value);
}

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wordChunks(word: string, maximum: number): string[] {
  const characters = Array.from(word);
  const chunks: string[] = [];
  for (let index = 0; index < characters.length; index += maximum) {
    chunks.push(characters.slice(index, index + maximum).join(""));
  }
  return chunks.length ? chunks : [""];
}

function wrap(value: string, maximum: number): string[] {
  const words = value.trim().split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (Array.from(word).length > maximum) {
      if (current) {
        lines.push(current);
        current = "";
      }
      const pieces = wordChunks(word, maximum);
      lines.push(...pieces.slice(0, -1));
      current = pieces.at(-1) ?? "";
      continue;
    }
    const next = current ? `${current} ${word}` : word;
    if (current && Array.from(next).length > maximum) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function text(value: string, x: number, y: number, size = 10, bold = false, color = INK) {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapeText(value)}) Tj ET`;
}

function estimatedTextWidth(value: string, size: number): number {
  return Array.from(value).length * size * 0.5;
}

function rightText(value: string, right: number, y: number, size = 9, bold = false, color = INK) {
  return text(value, right - estimatedTextWidth(value, size), y, size, bold, color);
}

function centeredText(value: string, center: number, y: number, size = 10, bold = false, color = INK) {
  return text(value, center - estimatedTextWidth(value, size) / 2, y, size, bold, color);
}

function line(y: number, x1 = LEFT, x2 = RIGHT, color = RULE, width = 0.7) {
  return `${color} RG ${width} w ${x1} ${y.toFixed(2)} m ${x2} ${y.toFixed(2)} l S`;
}

function verticalLine(x: number, y1: number, y2: number, color = RULE, width = 0.7) {
  return `${color} RG ${width} w ${x} ${y1.toFixed(2)} m ${x} ${y2.toFixed(2)} l S`;
}

function rectangle(x: number, y: number, width: number, height: number, color = RULE, strokeWidth = 0.6) {
  return `${color} RG ${strokeWidth} w ${x} ${y.toFixed(2)} ${width} ${height.toFixed(2)} re S`;
}

function filledRectangle(x: number, y: number, width: number, height: number, color: string) {
  return `${color} rg ${x} ${y.toFixed(2)} ${width} ${height.toFixed(2)} re f`;
}

function date(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(parsed);
}

function money(paise: number): string {
  const normalized = Number.isFinite(paise) ? Math.trunc(paise) : 0;
  const sign = normalized < 0 ? "-" : "";
  const absolute = Math.abs(normalized);
  const rupees = Math.floor(absolute / 100).toLocaleString("en-IN");
  const subunits = String(absolute % 100).padStart(2, "0");
  return `Rs. ${sign}${rupees}.${subunits}`;
}

function normalizeState(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase().replace(/\./g, "") ?? "";
  return normalized === "up" ? "uttar pradesh" : normalized;
}

function percent(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2)}%`;
}

function quantity(value: number): string {
  return Number.isFinite(value) && value > 0
    ? value.toLocaleString("en-IN", { maximumFractionDigits: 3 })
    : "—";
}

function parsePng(source: Uint8Array): LogoImage {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => source[index] === value)) throw new Error("Invalid logo PNG signature");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Uint8Array[] = [];
  while (offset + 12 <= source.length) {
    const length = new DataView(source.buffer, source.byteOffset + offset, 4).getUint32(0);
    const type = new TextDecoder().decode(source.slice(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > source.length) throw new Error("Invalid logo PNG chunk");
    if (type === "IHDR") {
      const header = new DataView(source.buffer, source.byteOffset + dataStart, length);
      width = header.getUint32(0);
      height = header.getUint32(4);
      bitDepth = header.getUint8(8);
      colorType = header.getUint8(9);
      interlace = header.getUint8(12);
    } else if (type === "IDAT") {
      idat.push(source.slice(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }
    offset = dataEnd + 4;
  }
  if (!width || !height || bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0 || !idat.length) {
    throw new Error("Unsupported logo PNG format");
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const decoded = inflateSync(bytes(...idat));
  const rgb = new Uint8Array(width * height * 3);
  const alpha = new Uint8Array(width * height);
  let sourceOffset = 0;
  let previous = new Uint8Array(stride);
  for (let row = 0; row < height; row += 1) {
    const filter = decoded[sourceOffset++];
    const current = new Uint8Array(stride);
    for (let index = 0; index < stride; index += 1) {
      const left = index >= bytesPerPixel ? current[index - bytesPerPixel] : 0;
      const above = previous[index] ?? 0;
      const aboveLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] ?? 0 : 0;
      const raw = decoded[sourceOffset++];
      let value: number;
      if (filter === 0) value = raw;
      else if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + above;
      else if (filter === 3) value = raw + Math.floor((left + above) / 2);
      else if (filter === 4) {
        const estimate = left + above - aboveLeft;
        const pa = Math.abs(estimate - left);
        const pb = Math.abs(estimate - above);
        const pc = Math.abs(estimate - aboveLeft);
        value = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? above : aboveLeft);
      } else throw new Error("Unsupported logo PNG filter");
      current[index] = value & 0xff;
    }
    for (let column = 0; column < width; column += 1) {
      const sourcePixel = column * bytesPerPixel;
      const targetPixel = (row * width + column) * 3;
      rgb[targetPixel] = current[sourcePixel] ?? 0;
      rgb[targetPixel + 1] = current[sourcePixel + 1] ?? 0;
      rgb[targetPixel + 2] = current[sourcePixel + 2] ?? 0;
      alpha[row * width + column] = colorType === 6 ? current[sourcePixel + 3] ?? 255 : 255;
    }
    previous = current;
  }
  return { width, height, rgb, alpha };
}

function loadLogo(): LogoImage | null {
  try {
    return parsePng(new Uint8Array(readFileSync(join(process.cwd(), "public", "logo3.png"))));
  } catch {
    return null;
  }
}

function streamObject(dictionary: string, data: Uint8Array): PdfObject {
  return bytes(`<< ${dictionary} /Length ${data.length} >>\nstream\n`, data, "\nendstream");
}

function buildPdf(pages: readonly string[][], logo: LogoImage | null): Uint8Array {
  const objects: PdfObject[] = [];
  const add = (body: PdfObject | string) => {
    objects.push(typeof body === "string" ? ascii(body) : body);
    return objects.length;
  };
  const pagesId = add("");
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const normal = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const bold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  let logoId: number | null = null;
  if (logo) {
    const alphaIsOpaque = logo.alpha.every((value) => value === 255);
    let maskId: number | null = null;
    if (!alphaIsOpaque) {
      maskId = add(streamObject("/Type /XObject /Subtype /Image /Width " + logo.width + " /Height " + logo.height + " /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode", deflateSync(logo.alpha)));
    }
    const maskReference = maskId ? ` /SMask ${maskId} 0 R` : "";
    logoId = add(streamObject(`/Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${maskReference}`, deflateSync(logo.rgb)));
  }
  const pageIds = pages.map((commands) => {
    const stream = ascii(commands.join("\n"));
    const streamId = add(streamObject("", stream));
    const xObject = logoId ? ` /XObject << /Im1 ${logoId} 0 R >>` : "";
    return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${normal} 0 R /F2 ${bold} 0 R >>${xObject} >> /Contents ${streamId} 0 R >>`);
  });
  objects[pagesId - 1] = ascii(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);

  let output = bytes("%PDF-1.4\n%", new Uint8Array([255, 255, 255, 255]), "\n");
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(output.length);
    output = bytes(output, `${index + 1} 0 obj\n`, object, "\nendobj\n");
  });
  const xref = output.length;
  output = bytes(output, `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`, offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join(""), `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return output;
}

function drawLogo(commands: string[], logoAvailable: boolean, y: number) {
  if (logoAvailable) {
    const width = 130;
    const height = width * 91 / 667;
    commands.push(`q ${width} 0 0 ${height} ${(PAGE_WIDTH - width) / 2} ${y} cm /Im1 Do Q`);
  } else {
    commands.push(centeredText("GARMOPS", PAGE_WIDTH / 2, y + 4, 12, true));
  }
}

function metadataLine(commands: string[], label: string, value: string, y: number) {
  commands.push(text(label, 355, y, 8, true, MUTED), rightText(value, RIGHT, y, 9));
}

function firstPageHeader(input: InvoicePdfInput, pageNumber: number, pageCount: number, logoAvailable: boolean): { commands: string[]; tableTopY: number } {
  const sellerAddressLines = wrap(input.seller.address, 45);
  const sellerGstinY = 786 - sellerAddressLines.length * 11 - 3;
  const titleY = Math.min(742, sellerGstinY - 27);
  const buyerTopY = titleY - 39;
  const commands: string[] = [
    text(input.seller.legalName, LEFT, 802, 12, true),
    ...sellerAddressLines.map((part, index) => text(part, LEFT, 786 - index * 11, 8.5, false, MUTED)),
    text(`GSTIN: ${input.seller.gstin}`, LEFT, sellerGstinY, 8.5),
    rightText("(Original For Recipient)", RIGHT, 802, 8.5, false, MUTED),
    text(`Page ${pageNumber} of ${pageCount}`, RIGHT - 55, 785, 8, false, MUTED),
  ];
  drawLogo(commands, logoAvailable, 778);
  commands.push(centeredText("Tax Invoice", PAGE_WIDTH / 2, titleY, 18, true), line(titleY - 13));

  const buyerNameLines = wrap(`Buyer: ${input.buyer.name}`, 39);
  let buyerY = buyerTopY;
  commands.push(...buyerNameLines.map((part, index) => text(part, LEFT, buyerY - index * 11, 10, index === 0)));
  buyerY -= buyerNameLines.length * 11 + 5;
  commands.push(text("Billing address", LEFT, buyerY, 8, true, MUTED));
  buyerY -= 13;
  const buyerAddressLines = wrap(input.buyer.address, 39);
  commands.push(...buyerAddressLines.map((part, index) => text(part, LEFT, buyerY - index * 11, 8.5, false, MUTED)));
  buyerY -= buyerAddressLines.length * 11 + 6;
  if (input.buyer.gstin) {
    commands.push(text(`Customer GSTIN/UIN: ${input.buyer.gstin}`, LEFT, buyerY, 8.5));
    buyerY -= 16;
  }
  const placeOfSupply = input.placeOfSupply?.trim() || input.buyer.state?.trim() || "Not available";
  commands.push(text(`Place of supply: ${placeOfSupply}`, LEFT, buyerY, 8.5));

  const metadataY = buyerTopY;
  metadataLine(commands, "Invoice No", input.number, metadataY);
  metadataLine(commands, "Invoice Date", date(input.issuedAt), metadataY - 18);
  metadataLine(commands, "Order No", input.orderNumber?.trim() || "Not available", metadataY - 36);
  metadataLine(commands, "Order Date", input.orderDate?.trim() ? date(input.orderDate) : "Not available", metadataY - 54);
  const metadataBottom = metadataY - 61;
  const tableTopY = Math.min(buyerY - 18, metadataBottom - 18);
  return { commands, tableTopY };
}

function continuedPageHeader(input: InvoicePdfInput, pageNumber: number, pageCount: number, logoAvailable: boolean): { commands: string[]; tableTopY: number } {
  const commands: string[] = [
    text(input.number, LEFT, 802, 9, true),
    centeredText("Tax Invoice - Continued", PAGE_WIDTH / 2, 800, 14, true),
    rightText(`Page ${pageNumber} of ${pageCount}`, RIGHT, 802, 8, false, MUTED),
    line(770),
  ];
  drawLogo(commands, logoAvailable, 778);
  return { commands, tableTopY: 744 };
}

function tableHeader(commands: string[], top: number) {
  commands.push(filledRectangle(LEFT, top - TABLE_HEADER_HEIGHT, RIGHT - LEFT, TABLE_HEADER_HEIGHT, "0.95 0.95 0.95"));
  commands.push(rectangle(LEFT, top - TABLE_HEADER_HEIGHT, RIGHT - LEFT, TABLE_HEADER_HEIGHT));
  for (const column of TABLE_COLUMNS.slice(1, -1)) commands.push(verticalLine(column, top, top - TABLE_HEADER_HEIGHT));
  commands.push(text("Details", TABLE_COLUMNS[0] + 7, top - 16, 8.5, true));
  commands.push(centeredText("HSN/SAC", (TABLE_COLUMNS[1] + TABLE_COLUMNS[2]) / 2, top - 16, 7.5, true));
  commands.push(centeredText("Qty", (TABLE_COLUMNS[2] + TABLE_COLUMNS[3]) / 2, top - 16, 8.5, true));
  commands.push(centeredText("Rate", (TABLE_COLUMNS[3] + TABLE_COLUMNS[4]) / 2, top - 16, 8.5, true));
  commands.push(centeredText("GST", (TABLE_COLUMNS[4] + TABLE_COLUMNS[5]) / 2, top - 16, 8.5, true));
  commands.push(rightText("Amount", TABLE_COLUMNS[6] - 7, top - 16, 8.5, true));
}

function rowForLine(lineItem: InvoiceLine, gstCell: string): InvoiceRow {
  const descriptionLines = wrap(lineItem.description, 39);
  const validQuantity = Number.isFinite(lineItem.quantity) && lineItem.quantity > 0;
  return {
    ...lineItem,
    descriptionLines,
    height: Math.max(24, descriptionLines.length * 11 + 11),
    ratePaise: validQuantity ? Math.round(lineItem.totalPaise / lineItem.quantity) : 0,
    gstCell,
  };
}

function drawLineRow(commands: string[], row: InvoiceRow, top: number) {
  const bottom = top - row.height;
  commands.push(rectangle(LEFT, bottom, RIGHT - LEFT, row.height));
  for (const column of TABLE_COLUMNS.slice(1, -1)) commands.push(verticalLine(column, top, bottom));
  row.descriptionLines.forEach((part, index) => commands.push(text(part, TABLE_COLUMNS[0] + 7, top - 14 - index * 11, 8.5)));
  const baseline = top - 14;
  commands.push(
    centeredText(row.hsnCode ?? "", (TABLE_COLUMNS[1] + TABLE_COLUMNS[2]) / 2, baseline, 8),
    centeredText(quantity(row.quantity), (TABLE_COLUMNS[2] + TABLE_COLUMNS[3]) / 2, baseline, 8.5),
    rightText(money(row.ratePaise), TABLE_COLUMNS[4] - 7, baseline, 8),
    centeredText(row.gstCell, (TABLE_COLUMNS[4] + TABLE_COLUMNS[5]) / 2, baseline, 7.2),
    rightText(money(row.totalPaise), TABLE_COLUMNS[6] - 7, baseline, 8),
  );
  return bottom;
}

function renderFinalDetails(commands: string[], input: InvoicePdfInput, bottomOfTable: number, sameState: boolean) {
  let totalsY = bottomOfTable - 17;
  const totalsX = 350;
  const amountRight = RIGHT - 7;
  const totalRow = (label: string, value: string, bold = false) => {
    commands.push(text(label, totalsX, totalsY, bold ? 10 : 8.5, bold), rightText(value, amountRight, totalsY, bold ? 10 : 8.5, bold));
    totalsY -= bold ? 22 : 18;
  };
  totalRow("Sub Total", money(input.subtotalPaise));
  if (input.discountPaise > 0) totalRow("Discount", `- ${money(input.discountPaise)}`);
  totalRow("Taxable Value", money(input.taxableValuePaise));
  totalRow("Shipping: Free", "");
  if (sameState) {
    const cgstPaise = Math.floor(input.taxPaise / 2);
    totalRow(`CGST (${percent(Math.floor(input.gstRateBasisPoints / 2))})`, money(cgstPaise));
    totalRow(`SGST (${percent(input.gstRateBasisPoints - Math.floor(input.gstRateBasisPoints / 2))})`, money(input.taxPaise - cgstPaise));
  } else {
    totalRow(`IGST (${percent(input.gstRateBasisPoints)})`, money(input.taxPaise));
  }
  commands.push(line(totalsY + 8, totalsX, RIGHT));
  totalRow("Total", money(input.totalPaise), true);
  totalRow("Balance Due", money(0), true);

  const wordsY = Math.max(315, bottomOfTable - 21);
  commands.push(text("Amount chargeable (in words):", LEFT, wordsY, 8.5, true));
  const wordsLines = wrap(amountInWords(input.totalPaise), 43);
  commands.push(...wordsLines.map((part, index) => text(part, LEFT, wordsY - 14 - index * 10, 8.5)));
  commands.push(text("Tax payable on RCM: No", LEFT, wordsY - 14 - wordsLines.length * 10 - 8, 8.5));

  commands.push(
    text(`For ${input.seller.legalName}`, 390, 272, 9, true),
    text("Authorised Signatory", 390, 236, 8.5, false, MUTED),
    line(190),
  );
  const bank = input.seller.bank;
  if (bank) {
    commands.push(
      text(`Bank: ${bank.name}`, LEFT, 166, 8.5),
      text(`A/c: ${bank.accountNumber}`, LEFT, 151, 8.5),
      text(`IFSC: ${bank.ifsc}`, LEFT, 136, 8.5),
    );
  }
  commands.push(
    text(`GSTIN: ${input.seller.gstin}`, 350, 166, 8.5),
    text(`MSME No: ${input.seller.msme ?? "Not available"}`, 350, 151, 8.5),
    centeredText("This is a system-generated tax invoice.", PAGE_WIDTH / 2, 54, 7.5, false, MUTED),
  );
}

function paginate(rows: InvoiceRow[], firstTableTop: number): InvoiceRow[][] {
  const pages: InvoiceRow[][] = [];
  let remaining = rows.slice();
  let tableTop = firstTableTop;
  while (remaining.length) {
    const finalCapacity = tableTop - TABLE_HEADER_HEIGHT - FINAL_PAGE_TABLE_BOTTOM;
    const remainingHeight = remaining.reduce((sum, row) => sum + row.height, 0);
    if (remainingHeight <= finalCapacity) {
      pages.push(remaining);
      break;
    }
    const normalCapacity = tableTop - TABLE_HEADER_HEIGHT - NORMAL_PAGE_BOTTOM;
    let used = 0;
    let take = 0;
    while (take < Math.min(MAX_ROWS_PER_PAGE, remaining.length - 1)) {
      const nextHeight = remaining[take]?.height ?? 0;
      if (take > 0 && used + nextHeight > normalCapacity) break;
      used += nextHeight;
      take += 1;
      if (used >= normalCapacity) break;
    }
    if (take === 0) take = 1;
    pages.push(remaining.slice(0, take));
    remaining = remaining.slice(take);
    tableTop = 744;
  }
  return pages.length ? pages : [[]];
}

export function buildInvoicePdf(input: InvoicePdfInput): { bytes: Uint8Array; filename: string } {
  const sameState = normalizeState(input.buyer.state) === normalizeState(input.seller.state);
  const gstCell = sameState
    ? `${percent(Math.floor(input.gstRateBasisPoints / 2))} + ${percent(input.gstRateBasisPoints - Math.floor(input.gstRateBasisPoints / 2))}`
    : percent(input.gstRateBasisPoints);
  const rows = input.lines.map((lineItem) => rowForLine(lineItem, gstCell));
  const logo = loadLogo();
  const layoutProbe = firstPageHeader(input, 1, 1, Boolean(logo));
  const pageRows = paginate(rows, layoutProbe.tableTopY);
  const pageCount = pageRows.length;
  const pages = pageRows.map((pageLines, index) => {
    const pageNumber = index + 1;
    const firstPage = pageNumber === 1;
    const lastPage = pageNumber === pageCount;
    const header = firstPage
      ? firstPageHeader(input, pageNumber, pageCount, Boolean(logo))
      : continuedPageHeader(input, pageNumber, pageCount, Boolean(logo));
    const commands = header.commands;
    tableHeader(commands, header.tableTopY);
    let y = header.tableTopY - TABLE_HEADER_HEIGHT;
    for (const row of pageLines) y = drawLineRow(commands, row, y);
    if (lastPage) renderFinalDetails(commands, input, y, sameState);
    else commands.push(text("Continued on next page", LEFT, 42, 7.5, false, MUTED));
    return commands;
  });
  return {
    bytes: buildPdf(pages, logo),
    filename: `${input.number.replace(/[^A-Za-z0-9._-]/g, "-")}.pdf`,
  };
}
