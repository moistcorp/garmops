import { describe, expect, it } from "vitest";
import { founderRefundRequest, paymentIdFromFoundryOrder } from "./refund";

describe("Foundry refund contract", () => {
  it("reads only the safe Medusa payment identity from an order response", () => {
    expect(paymentIdFromFoundryOrder({ payment: { id: "pay_123" } })).toBe("pay_123");
    expect(paymentIdFromFoundryOrder({ payment: null })).toBeNull();
    expect(paymentIdFromFoundryOrder({})).toBeNull();
  });

  it("targets the existing Founder refund endpoint with the native payment ID", () => {
    expect(founderRefundRequest("pay_123", "refund-test-1")).toEqual({
      path: "/foundry/payments/pay_123/refund",
      body: { idempotencyKey: "refund-test-1" },
    });
  });
});
