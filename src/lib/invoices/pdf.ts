import "server-only";

import { formatMoneyPaise } from "@/lib/orders/format";

type InvoiceLine = {
  description: string;
  quantity: number;
  totalPaise: number;
  hsnCode?: string;
};

export type InvoicePdfInput = {
  number: string;
  issuedAt: string;
  seller: { legalName: string; address: string; gstin: string; state: string };
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
const LINES_PER_PAGE = 12;

function escapeText(value: string) {
  return value
    .replace(/₹/g, "Rs. ")
    .replace(/[–—]/g, "-")
    .replace(/[^\x00-\x7F]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}
function text(value: string, x: number, y: number, size = 10, bold = false) {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf 0.07 0.07 0.07 rg 1 0 0 1 ${x} ${y} Tm (${escapeText(value)}) Tj ET`;
}
function line(y: number) { return `0.84 0.84 0.84 RG 0.7 w 42 ${y} m 553 ${y} l S`; }
function date(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(new Date(value));
}
function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result.length ? result : [[]];
}

function buildPdf(pages: readonly string[][]): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const pagesId = add("");
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const normal = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const bold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds = pages.map((commands) => {
    const stream = commands.join("\n");
    const streamId = add(`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`);
    return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${normal} 0 R /F2 ${bold} 0 R >> >> /Contents ${streamId} 0 R >>`);
  });
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let output = "%PDF-1.4\n%\xFF\xFF\xFF\xFF\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(encoder.encode(output).length);
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = encoder.encode(output).length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return encoder.encode(output);
}

function normalizeState(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase().replace(/\./g, "") ?? "";
  return normalized === "up" ? "uttar pradesh" : normalized;
}

function pageHeader(input: InvoicePdfInput, pageNumber: number, pageCount: number): string[] {
  const firstPage = pageNumber === 1;
  const commands = [
    "0.06 0.38 0.39 rg 0 802 595 40 re f",
    text("GARMOPS / MOIST CORP", 42, 817, 14, true).replace("0.07 0.07 0.07 rg", "1 1 1 rg"),
    text(`Page ${pageNumber} of ${pageCount}`, 490, 817, 8).replace("0.07 0.07 0.07 rg", "1 1 1 rg"),
    text("GST Tax Invoice", 42, 760, 24, true),
    text(`${input.number}  ·  ${date(input.issuedAt)}`, 42, 738, 10),
    line(720),
  ];
  if (firstPage) {
    commands.push(
      text("Seller", 42, 696, 9, true),
      text(input.seller.legalName, 42, 678, 11, true),
      text(input.seller.address.slice(0, 72), 42, 662, 9),
      text(`GSTIN: ${input.seller.gstin}`, 42, 646, 9),
      text("Bill to", 315, 696, 9, true),
      text(input.buyer.name, 315, 678, 11, true),
      text(input.buyer.address.slice(0, 72), 315, 662, 9),
      ...(input.buyer.gstin ? [text(`GSTIN: ${input.buyer.gstin}`, 315, 646, 9)] : []),
      line(624),
    );
  } else {
    commands.push(text("Invoice line items continued", 42, 690, 10, true), line(674));
  }
  return commands;
}

export function buildInvoicePdf(input: InvoicePdfInput): { bytes: Uint8Array; filename: string } {
  const sameState = normalizeState(input.buyer.state) === normalizeState(input.seller.state);
  const taxLabel = sameState
    ? `CGST + SGST (${(input.gstRateBasisPoints / 200).toFixed(2)}% each)`
    : `IGST (${(input.gstRateBasisPoints / 100).toFixed(2)}%)`;
  const linePages = chunks(input.lines, LINES_PER_PAGE);
  const pages = linePages.map((pageLines, index) => {
    const pageNumber = index + 1;
    const firstPage = pageNumber === 1;
    const lastPage = pageNumber === linePages.length;
    const commands = pageHeader(input, pageNumber, linePages.length);
    const headingY = firstPage ? 604 : 648;
    commands.push(
      text("Description", 42, headingY, 9, true),
      text("Qty", 355, headingY, 9, true),
      text("HSN", 410, headingY, 9, true),
      text("Amount", 488, headingY, 9, true),
    );
    let y = headingY - 22;
    for (const item of pageLines) {
      commands.push(
        text(item.description.slice(0, 52), 42, y, 9),
        text(item.quantity.toLocaleString("en-IN"), 355, y, 9),
        text(item.hsnCode ?? "610910", 410, y, 9),
        text(formatMoneyPaise(item.totalPaise), 488, y, 9),
      );
      y -= 22;
    }
    if (lastPage) {
      y -= 8;
      commands.push(line(y + 8), text("Subtotal", 330, y - 12, 9), text(formatMoneyPaise(input.subtotalPaise), 488, y - 12, 9));
      if (input.discountPaise > 0) {
        commands.push(text("Discount", 330, y - 32, 9), text(`-${formatMoneyPaise(input.discountPaise)}`, 488, y - 32, 9));
        y -= 20;
      }
      commands.push(
        text("Taxable value", 330, y - 32, 9),
        text(formatMoneyPaise(input.taxableValuePaise), 488, y - 32, 9),
        text(taxLabel, 330, y - 52, 9),
        text(formatMoneyPaise(input.taxPaise), 488, y - 52, 9),
        line(y - 64),
        text("Total paid", 330, y - 84, 12, true),
        text(formatMoneyPaise(input.totalPaise), 480, y - 84, 12, true),
      );
    }
    commands.push(
      text("Shipping is excluded and, when required, is billed separately through a staff-issued payment link.", 42, 120, 8),
      text("This is a system-generated tax invoice based on the verified payment record.", 42, 102, 8),
    );
    return commands;
  });
  return {
    bytes: buildPdf(pages),
    filename: `${input.number.replace(/[^A-Za-z0-9._-]/g, "-")}.pdf`,
  };
}
