import { describe, expect, it } from "vitest";

import {
  normalizePaymentCheckoutType,
  paymentFailureReturnHref,
} from "./checkoutReturn";

describe("payment failure return destination", () => {
  it("returns sample payments to the durable sample checkout", () => {
    expect(paymentFailureReturnHref("cart_sample_1", "sample")).toBe(
      "/checkout?payment=failure&checkoutAttempt=cart_sample_1",
    );
  });

  it("returns configured payments to their saved confirmation step", () => {
    expect(paymentFailureReturnHref("cart/configured", "configured")).toBe(
      "/configurator/cart/cart%2Fconfigured/confirmation?payment=failure&checkoutAttempt=cart%2Fconfigured",
    );
  });

  it("uses the neutral recovery page when the cart type is unavailable", () => {
    expect(paymentFailureReturnHref("cart_legacy", null)).toBe(
      "/account/orders?payment=failure&checkoutAttempt=cart_legacy",
    );
  });
});

describe("payment checkout type normalization", () => {
  it("accepts only known checkout types", () => {
    expect(normalizePaymentCheckoutType("sample")).toBe("sample");
    expect(normalizePaymentCheckoutType("configured")).toBe("configured");
    expect(normalizePaymentCheckoutType("other")).toBeNull();
    expect(normalizePaymentCheckoutType(undefined)).toBeNull();
  });
});
