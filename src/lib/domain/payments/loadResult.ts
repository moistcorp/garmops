import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function loadDurablePaymentResult(
  attemptId: string,
  orderNumber: string,
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_attempts")
    .select(
      "id, amount_paise, status, order_id, orders!inner(order_number, submitted_at)",
    )
    .eq("id", attemptId)
    .maybeSingle();
  if (error || !data) return null;

  const order = data.orders as unknown as {
    order_number: string;
    submitted_at: string;
  };
  if (order.order_number !== orderNumber) return null;

  const { data: invoice } = await admin
    .from("invoices")
    .select("sync_status, document_number, pdf_file_id")
    .eq("payment_attempt_id", attemptId)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  return {
    orderNumber,
    submittedAt: order.submitted_at,
    amountPaise: data.amount_paise,
    paymentStatus: data.status,
    invoiceStatus: invoice?.sync_status ?? null,
    invoiceNumber: invoice?.document_number ?? null,
    invoicePdfFileId: invoice?.pdf_file_id ?? null,
  };
}
