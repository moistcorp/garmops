import "server-only";

import { getServerEnvironment } from "@/lib/config/env";
import { buildInvoicePdf } from "@/lib/invoices/pdf";
import { putPrivatePdf } from "@/lib/r2/put";
import { createAdminClient } from "@/lib/supabase/admin";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
function address(value: unknown): string {
  const item = record(value);
  return [item.line1, item.line2, item.city, item.state, item.postalCode]
    .filter((part) => typeof part === "string" && part.trim())
    .join(", ");
}

export async function createTaxInvoiceForOrder(orderId: string) {
  const admin = createAdminClient();
  const env = getServerEnvironment();
  const [{ data: invoice, error: invoiceError }, { data: order, error: orderError }] = await Promise.all([
    admin.from("invoices")
      .select("id, order_id, invoice_number, status, subtotal_paise, discount_paise, taxable_value_paise, tax_paise, total_paise, paid_paise, line_items, seller_snapshot, buyer_snapshot, place_of_supply, pdf_file_id, issued_at")
      .eq("order_id", orderId)
      .eq("kind", "tax_invoice")
      .single(),
    admin.from("orders")
      .select("id, order_number, customer_user_id, amount_paid_paise, billing_snapshot, shipping_snapshot")
      .eq("id", orderId)
      .single(),
  ]);
  if (invoiceError || !invoice) throw new Error(invoiceError?.message ?? "Invoice record was not found");
  if (orderError || !order) throw new Error(orderError?.message ?? "Order was not found");
  if (Number(order.amount_paid_paise) !== Number(invoice.total_paise) || Number(invoice.paid_paise) !== Number(invoice.total_paise)) {
    throw Object.assign(new Error("Invoice generation requires a fully paid order"), { retryable: false });
  }

  let invoiceNumber = invoice.invoice_number as string | null;
  if (!invoiceNumber) {
    const { data, error } = await admin.rpc("next_number", { p_namespace: "invoice", p_prefix: "INV" });
    if (error || !data) throw new Error(error?.message ?? "Invoice number could not be allocated");
    invoiceNumber = String(data);
  }
  const issuedAt = invoice.issued_at ?? new Date().toISOString();
  const buyerSnapshot = record(invoice.buyer_snapshot);
  const buyerAddress = record(buyerSnapshot.address);
  const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items.map(record) : [];
  const lines = lineItems.map((item) => ({
    description: String(item.description ?? "Garmops garment order"),
    quantity: Number(item.quantity ?? 1),
    totalPaise: Number(item.lineTotalPaise ?? 0),
    hsnCode: String(item.hsnCode ?? env.INVOICE_DEFAULT_HSN_CODE),
  }));
  if (lines.reduce((sum, item) => sum + item.totalPaise, 0) !== Number(invoice.subtotal_paise)) {
    throw Object.assign(new Error("Invoice line totals do not match the order subtotal"), { retryable: false });
  }

  const generated = buildInvoicePdf({
    number: invoiceNumber,
    issuedAt,
    seller: {
      legalName: env.INVOICE_SELLER_LEGAL_NAME,
      address: env.INVOICE_SELLER_ADDRESS,
      gstin: env.INVOICE_SELLER_GSTIN,
      state: env.INVOICE_SELLER_STATE,
    },
    buyer: {
      name: String(buyerSnapshot.entity ?? buyerSnapshot.name ?? "Customer"),
      address: address(buyerSnapshot.address) || address(record(order.shipping_snapshot).address) || "Address not provided",
      gstin: typeof buyerSnapshot.gstin === "string" ? buyerSnapshot.gstin : null,
      state: typeof buyerAddress.state === "string" ? buyerAddress.state : null,
    },
    lines,
    subtotalPaise: Number(invoice.subtotal_paise),
    discountPaise: Number(invoice.discount_paise),
    taxableValuePaise: Number(invoice.taxable_value_paise),
    taxPaise: Number(invoice.tax_paise),
    totalPaise: Number(invoice.total_paise),
    gstRateBasisPoints: env.INVOICE_GST_RATE_BASIS_POINTS,
  });

  let pdfFileId = invoice.pdf_file_id as string | null;
  if (!pdfFileId) {
    const objectKey = `customers/${order.customer_user_id}/orders/${order.id}/invoices/${invoice.id}/${generated.filename}`;
    const stored = await putPrivatePdf({
      objectKey,
      filename: generated.filename,
      bytes: generated.bytes,
      metadata: { "invoice-id": invoice.id, "order-id": order.id },
    });
    const { data: file, error: fileError } = await admin.from("order_files").insert({
      order_id: order.id,
      uploaded_by: order.customer_user_id,
      kind: "invoice_pdf",
      visibility: "customer",
      bucket_name: stored.bucket,
      object_key: stored.objectKey,
      original_filename: generated.filename,
      safe_filename: generated.filename,
      extension: "pdf",
      content_type: "application/pdf",
      byte_size: stored.byteSize,
      sha256: stored.sha256,
      object_etag: stored.etag,
      upload_status: "finalized",
      scan_status: "not_required",
      review_status: "approved",
      finalized_at: new Date().toISOString(),
    }).select("id").single();
    if (fileError || !file) throw new Error(fileError?.message ?? "Invoice PDF record could not be created");
    pdfFileId = file.id;
  }

  const { error: updateError } = await admin.from("invoices").update({
    invoice_number: invoiceNumber,
    status: "completed",
    pdf_file_id: pdfFileId,
    issued_at: issuedAt,
  }).eq("id", invoice.id);
  if (updateError) throw new Error(updateError.message);
  return { invoiceId: invoice.id, invoiceNumber, pdfFileId };
}

export async function markTaxInvoiceFailure(orderId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Invoice generation failed";
  const retryable = !(error && typeof error === "object" && "retryable" in error && (error as { retryable?: unknown }).retryable === false);
  await createAdminClient().from("invoices").update({
    status: retryable ? "retryable_failure" : "permanent_failure",
  }).eq("order_id", orderId).eq("kind", "tax_invoice");
  return Object.assign(new Error(message), { retryable });
}
