export type FoundryOrderPayment = { id?: unknown } | null | undefined;

export function paymentIdFromFoundryOrder(order: { payment?: FoundryOrderPayment }): string | null {
  const paymentId = order.payment?.id;
  return typeof paymentId === "string" && paymentId.length > 0 ? paymentId : null;
}

export function founderRefundRequest(paymentId: string, idempotencyKey: string) {
  return {
    path: `/foundry/payments/${encodeURIComponent(paymentId)}/refund`,
    body: { idempotencyKey },
  };
}
