import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function loadDurablePaymentResult(attemptId: string, orderNumber: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("payment_attempts")
    .select("id, amount_paise, status, order_id, orders!inner(order_number, order_type, submitted_at)")
    .eq("id", attemptId)
    .maybeSingle();
  if (error || !data) return null;
  const order = data.orders as unknown as { order_number: string; order_type: string; submitted_at: string };
  if (order.order_number !== orderNumber) return null;
  const { data: invoice } = await admin.from("invoices")
    .select("status, invoice_number, pdf_file_id")
    .eq("order_id", data.order_id)
    .eq("kind", "tax_invoice")
    .maybeSingle();
  return {
    orderNumber,
    orderType: order.order_type,
    submittedAt: order.submitted_at,
    amountPaise: data.amount_paise,
    paymentStatus: data.status,
    invoiceStatus: invoice?.status ?? null,
    invoiceNumber: invoice?.invoice_number ?? null,
    invoicePdfFileId: invoice?.pdf_file_id ?? null,
  };
}
