import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function loadDurablePaymentResult(attemptId: string, orderNumber: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("payment_attempts")
    .select("id, amount_paise, status, purpose, order_id, orders!inner(order_number, order_type, submitted_at)")
    .eq("id", attemptId)
    .maybeSingle();
  if (error || !data) return null;
  const order = data.orders as unknown as { order_number: string; order_type: string; submitted_at: string };
  if (order.order_number !== orderNumber) return null;
  const [{ data: invoice }, { data: checkoutSession }] = await Promise.all([
    admin.from("invoices")
      .select("status, invoice_number, pdf_file_id")
      .eq("order_id", data.order_id)
      .eq("kind", "tax_invoice")
      .maybeSingle(),
    order.order_type === "custom_bulk"
      ? admin.from("custom_checkout_sessions")
          .select("cart_id")
          .eq("final_order_id", data.order_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  return {
    orderNumber,
    orderType: order.order_type,
    submittedAt: order.submitted_at,
    amountPaise: data.amount_paise,
    paymentStatus: data.status,
    paymentPurpose: data.purpose,
    invoiceStatus: invoice?.status ?? null,
    invoiceNumber: invoice?.invoice_number ?? null,
    invoicePdfFileId: invoice?.pdf_file_id ?? null,
    cartId: checkoutSession?.cart_id ?? null,
  };
}
