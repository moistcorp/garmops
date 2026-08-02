import "server-only";

import { Resend } from "resend";
import { getServerEnvironment } from "@/lib/config/env";
import { buildInvoicePdf } from "@/lib/invoices/pdf";
import { putPrivatePdf } from "@/lib/r2/put";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.generated";

function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function address(value: unknown) { const item = record(value); return [item.line1, item.line2, item.city, item.state, item.postalCode].filter((part) => typeof part === "string" && part.trim()).join(", "); }

function hsnCodeForProduct(productName: string, fallback: string) {
  const product = productName.toLowerCase();
  if (product.includes("canvas tote")) return "4202";
  if (product.includes("hoodie") || product.includes("sweatshirt")) return "6110";
  if (product.includes("tee") || product.includes("t-shirt") || product.includes("t shirt")) return "610910";
  return fallback;
}

export async function createReservationInvoice(invoiceId: string) {
  const admin = createAdminClient(); const env = getServerEnvironment();
  const { data: invoice, error: invoiceError } = await admin.from("invoices").select("id, order_id, payment_attempt_id, document_number, issue_date, sync_status, pdf_file_id, total_paise, emailed_at").eq("id", invoiceId).single();
  if (invoiceError || !invoice) throw new Error(invoiceError?.message ?? "Invoice record was not found");
  const { data: order, error: orderError } = await admin.from("orders").select("id, order_number, organization_id, customer_snapshot, billing_snapshot, shipping_snapshot, organizations(display_name, legal_name, gstin), order_items(product_name, quantity, line_total_paise)").eq("id", invoice.order_id).single();
  if (orderError || !order) throw new Error(orderError?.message ?? "Order was not found");
  const { data: payment, error: paymentError } = await admin.from("payment_attempts").select("id, status, amount_paise, customer_email, customer_name").eq("id", invoice.payment_attempt_id ?? "00000000-0000-0000-0000-000000000000").single();
  if (paymentError || !payment || payment.status !== "paid") throw new Error("A verified payment is required before generating an invoice");
  const organization = Array.isArray(order.organizations) ? order.organizations[0] : order.organizations;
  const buyerAddress = address(record(order.billing_snapshot).address) || address(record(order.shipping_snapshot).address);
  const buyerState = record(record(order.billing_snapshot).address).state ?? record(record(order.shipping_snapshot).address).state;
  const isGstInvoice = Boolean(organization?.gstin);
  const { data: number, error: numberError } = await (admin.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: string | null; error: { message: string } | null }>)("assign_invoice_number", { p_invoice_id: invoice.id });
  if (numberError || !number) throw new Error(numberError?.message ?? "Invoice number could not be allocated");
  const issuedAt = invoice.issue_date ? `${invoice.issue_date}T00:00:00+05:30` : new Date().toISOString();
  const items = order.order_items ?? [];
  const lines = items.map((item) => ({
    description: item.product_name,
    quantity: item.quantity,
    totalPaise: item.line_total_paise ?? Math.round(payment.amount_paise * item.quantity / Math.max(1, items.reduce((total, entry) => total + entry.quantity, 0))),
    hsnCode: hsnCodeForProduct(item.product_name, env.INVOICE_DEFAULT_HSN_CODE),
  }));
  const generated = buildInvoicePdf({ number, issuedAt, isGstInvoice, seller: { legalName: env.INVOICE_SELLER_LEGAL_NAME, address: env.INVOICE_SELLER_ADDRESS, gstin: env.INVOICE_SELLER_GSTIN, state: env.INVOICE_SELLER_STATE }, buyer: { name: organization?.legal_name || organization?.display_name || payment.customer_name, address: buyerAddress || "Address not provided", gstin: organization?.gstin, state: typeof buyerState === "string" ? buyerState : null }, lines, totalPaise: payment.amount_paise, gstRateBasisPoints: env.INVOICE_GST_RATE_BASIS_POINTS });
  let pdfFileId = invoice.pdf_file_id;
  if (!pdfFileId) {
    const objectKey = `organizations/${order.organization_id}/orders/${order.id}/invoices/${invoice.id}/${generated.filename}`;
    const stored = await putPrivatePdf({ objectKey, filename: generated.filename, bytes: generated.bytes, metadata: { "invoice-id": invoice.id, "order-id": order.id } });
    const { data: file, error: fileError } = await admin.from("order_files").insert({ order_id: order.id, kind: "invoice_pdf", visibility: "customer", bucket_name: stored.bucket, object_key: stored.objectKey, original_filename: generated.filename, safe_filename: generated.filename, content_type: "application/pdf", byte_size: stored.byteSize, sha256: stored.sha256, scan_status: "not_required", provider_source: "garmops", upload_status: "finalized", finalized_at: new Date().toISOString(), object_etag: stored.etag }).select("id").single();
    if (fileError || !file) throw new Error(fileError?.message ?? "Invoice PDF file row could not be created"); pdfFileId = file.id;
  }
  const taxable = isGstInvoice ? Math.round(payment.amount_paise * 10_000 / (10_000 + env.INVOICE_GST_RATE_BASIS_POINTS)) : payment.amount_paise;
  const { error: updateError } = await admin.from("invoices").update({ provider: "garmops", sync_status: "completed", document_number: number, issue_date: issuedAt.slice(0, 10), subtotal_paise: taxable, tax_paise: payment.amount_paise - taxable, total_paise: payment.amount_paise, paid_paise: payment.amount_paise, balance_paise: 0, tax_configuration_snapshot: { format: isGstInvoice ? "gst" : "simple", hsn_codes: isGstInvoice ? [...new Set(lines.map((line) => line.hsnCode))] : [], gst_rate_basis_points: isGstInvoice ? env.INVOICE_GST_RATE_BASIS_POINTS : 0 } as Json, pdf_file_id: pdfFileId, completed_at: new Date().toISOString(), last_error_code: null, last_error_message: null, next_attempt_at: null }).eq("id", invoice.id);
  if (updateError) throw new Error(updateError.message);
  if (!invoice.emailed_at && env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) { const resend = new Resend(env.RESEND_API_KEY); const { error: emailError } = await resend.emails.send({ from: env.RESEND_FROM_EMAIL, to: payment.customer_email, subject: `Invoice ${number} for ${order.order_number}`, html: `<p>Hi ${payment.customer_name},</p><p>Your invoice <strong>${number}</strong> is attached. You can also download it from your order in Garmops.</p>`, attachments: [{ filename: generated.filename, content: Buffer.from(generated.bytes).toString("base64") }] }, { idempotencyKey: `garmops-invoice-${invoice.id}` }); if (emailError) throw Object.assign(new Error(emailError.message), { retryable: true }); await admin.from("invoices").update({ emailed_at: new Date().toISOString() }).eq("id", invoice.id); }
  return { invoiceId: invoice.id, documentNumber: number, pdfFileId };
}

export async function markReservationInvoiceFailure(invoiceId: string, error: unknown) {
  const admin = createAdminClient(); const message = error instanceof Error ? error.message : "Invoice generation failed";
  await admin.from("invoices").update({ sync_status: "retryable_failure", last_error_code: "INVOICE_GENERATION_FAILED", last_error_message: message.slice(0, 2000), next_attempt_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() }).eq("id", invoiceId);
  return Object.assign(new Error(message), { retryable: true });
}
