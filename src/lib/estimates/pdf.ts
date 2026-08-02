import "server-only";

import { formatMoneyPaise } from "@/lib/orders/format";
import { estimateFilename } from "./presentation";
import type { EstimateRecord } from "@/lib/pricing/types";

type PdfPage = string[];
const encoder = new TextEncoder();

function escapeText(value: string): string {
  return value.replace(/₹/g, "Rs. ").replace(/[–—]/g, "-").replace(/×/g, "x").replace(/[^\x00-\x7F]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function text(value: string, x: number, y: number, size = 10, bold = false): string {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf 0.07 0.07 0.07 rg 1 0 0 1 ${x} ${y} Tm (${escapeText(value)}) Tj ET`;
}

function line(y: number): string {
  return `0.84 0.84 0.84 RG 0.7 w 42 ${y} m 553 ${y} l S`;
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function pageForEstimate(estimate: EstimateRecord): PdfPage {
  const snapshot = estimate.pricing_snapshot;
  const page: PdfPage = [];
  page.push("0.06 0.38 0.39 rg 0 802 595 40 re f");
  page.push(text("GARMOPS", 42, 817, 14, true).replace("0.07 0.07 0.07 rg", "1 1 1 rg"));
  page.push(text("Design & Cost Estimate", 42, 760, 24, true));
  page.push(text(`${estimate.estimate_number}  ·  Generated ${dateLabel(estimate.generated_at)}`, 42, 737, 10));
  page.push(text(`Valid until ${dateLabel(estimate.valid_until)}`, 42, 720, 10));
  page.push(line(704));
  page.push(text("Prepared for", 42, 678, 9, true));
  page.push(text(snapshot.company.companyName || "Garmops customer", 42, 658, 14, true));
  page.push(text(snapshot.company.contactName, 42, 640, 10));
  page.push(text(snapshot.company.contactEmail, 42, 624, 10));
  if (snapshot.company.gstin) page.push(text(`GSTIN ${snapshot.company.gstin}`, 42, 608, 10));
  page.push(text("Product specification", 42, 565, 14, true));
  page.push(text(`${snapshot.product.name} · ${snapshot.colour.name}`, 42, 542, 11, true));
  page.push(text(`${snapshot.quantity.toLocaleString("en-IN")} units · ${snapshot.colour.type === "custom_dye" ? "Custom dye" : "Signature colour"}`, 42, 524, 10));
  page.push(text(`Front: ${snapshot.customisation.front.present ? `${snapshot.customisation.front.technique ?? "Technique to be confirmed"}, ${snapshot.customisation.front.width ?? "-"} x ${snapshot.customisation.front.height ?? "-"} cm` : "No artwork"}`, 42, 500, 9));
  page.push(text(`Back: ${snapshot.customisation.back.present ? `${snapshot.customisation.back.technique ?? "Technique to be confirmed"}, ${snapshot.customisation.back.width ?? "-"} x ${snapshot.customisation.back.height ?? "-"} cm` : "No artwork"}`, 42, 484, 9));
  page.push(text(`Neck label: ${snapshot.customisation.neckLabel.present ? `${snapshot.customisation.neckLabel.dimensions ?? "Custom label"}, ${snapshot.customisation.neckLabel.position ?? "placement to be confirmed"}` : "Standard label"}`, 42, 468, 9));
  page.push(text("Size allocation: To be confirmed before checkout", 42, 450, 9));
  page.push(text("Commercial estimate", 42, 410, 14, true));
  const rows: Array<[string, string, boolean]> = [
    ["Merchandise subtotal", formatMoneyPaise(estimate.subtotal_paise), false],
    ["Volume discount", estimate.discount_paise ? `-${formatMoneyPaise(estimate.discount_paise)}` : formatMoneyPaise(0), false],
    ["Taxable subtotal", formatMoneyPaise(estimate.taxable_subtotal_paise), false],
    ["GST", formatMoneyPaise(estimate.gst_paise), false],
    ["Estimated total", formatMoneyPaise(estimate.total_paise), true],
  ];
  let y = 382;
  for (const [label, value, bold] of rows) {
    page.push(text(label, 42, y, 10, bold));
    page.push(text(value, 450, y, 10, bold));
    page.push(line(y - 10));
    y -= 25;
  }
  page.push(text("Shipping calculated after delivery address", 42, 245, 9));
  page.push(text(`Reservation amount due today: ${formatMoneyPaise(estimate.reservation_fee_paise)}`, 42, 220, 11, true));
  page.push(text(`Estimated balance later: ${formatMoneyPaise(estimate.balance_due_paise)}`, 42, 200, 10));
  page.push(text("Terms", 42, 160, 12, true));
  const terms = [
    "This is an estimate, not a final tax invoice.",
    `It is valid until ${dateLabel(estimate.valid_until)}.`,
    "Final pricing is confirmed after artwork and production review.",
    "Shipping is separate unless explicitly shown as included.",
    "Changing the design, quantity, technique or delivery requirement requires a refreshed estimate.",
    "The reservation fee is adjusted against the final order value according to the existing project terms.",
  ];
  terms.forEach((term, index) => page.push(text(`• ${term}`, 48, 140 - index * 16, 8.5)));
  return page;
}

function buildPdf(pages: PdfPage[]): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const pagesId = add("");
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const fontRegularId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds = pages.map((commands) => {
    const stream = commands.join("\n");
    const streamId = add(`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`);
    return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${streamId} 0 R >>`);
  });
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let output = "%PDF-1.4\n%\xFF\xFF\xFF\xFF\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(encoder.encode(output).length); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = encoder.encode(output).length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return encoder.encode(output);
}

export function buildEstimatePdf(estimate: EstimateRecord): { bytes: Uint8Array; filename: string } {
  return { bytes: buildPdf([pageForEstimate(estimate)]), filename: estimateFilename(estimate.estimate_number) };
}
