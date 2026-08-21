export type PaymentCheckoutType = "sample" | "configured";

export function normalizePaymentCheckoutType(
  value: unknown,
): PaymentCheckoutType | null {
  return value === "sample" || value === "configured" ? value : null;
}

export function paymentFailureReturnHref(
  cartId: string,
  checkoutType: PaymentCheckoutType | null,
): string {
  const encodedCartId = encodeURIComponent(cartId);

  if (checkoutType === "sample") {
    return `/checkout?payment=failure&checkoutAttempt=${encodedCartId}`;
  }

  if (checkoutType === "configured") {
    return `/configurator/cart/${encodedCartId}/confirmation?payment=failure&checkoutAttempt=${encodedCartId}`;
  }

  return `/account/orders?payment=failure&checkoutAttempt=${encodedCartId}`;
}
