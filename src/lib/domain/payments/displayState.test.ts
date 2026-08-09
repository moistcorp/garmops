import { describe, expect, it } from "vitest";

import {
  getPaymentDisplayState,
  paymentStatusLabel,
} from "./displayState";

describe("payment display state", () => {
  it("never exposes internal status names as labels", () => {
    expect(paymentStatusLabel(getPaymentDisplayState({ outcome: "pending", paymentStatus: "provider_pending" }))).toBe("Being verified");
    expect(paymentStatusLabel(getPaymentDisplayState({ outcome: "success", paymentStatus: "duplicate_success" }))).toBe("Needs review");
    expect(paymentStatusLabel(getPaymentDisplayState({ outcome: "pending", paymentStatus: "disputed" }))).toBe("Needs review");
    expect(paymentStatusLabel(getPaymentDisplayState({ outcome: "success", paymentStatus: "refunded" }))).toBe("Refunded");
  });

  it("lets durable final states override a stale redirect outcome", () => {
    expect(getPaymentDisplayState({ outcome: "failure", paymentStatus: "paid" })).toBe("success");
    expect(getPaymentDisplayState({ outcome: "pending", paymentStatus: "failed" })).toBe("failure");
  });
});
