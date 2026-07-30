import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  createCommandHash,
  createPaymentRequestHash,
  formatPaiseAsRupees,
  parseRupeesToPaise,
  paymentEventFingerprint,
  verifyPaymentResponseHash,
} from "./hashing";
import type { PayuIncomingFields } from "./types";

function responseHash(
  fields: PayuIncomingFields,
  salt: string,
  options?: { additionalCharges?: string; splitInfo?: string },
): string {
  const parts = options?.splitInfo
    ? [
        salt,
        fields.status,
        options.splitInfo,
        "",
        "",
        "",
        "",
        "",
        fields.udf5,
        fields.udf4,
        fields.udf3,
        fields.udf2,
        fields.udf1,
        fields.email,
        fields.firstname,
        fields.productinfo,
        fields.amount,
        fields.txnid,
        fields.key,
      ]
    : [
        salt,
        fields.status,
        "",
        "",
        "",
        "",
        "",
        fields.udf5,
        fields.udf4,
        fields.udf3,
        fields.udf2,
        fields.udf1,
        fields.email,
        fields.firstname,
        fields.productinfo,
        fields.amount,
        fields.txnid,
        fields.key,
      ];
  if (options?.additionalCharges) parts.unshift(options.additionalCharges);
  return createHash("sha512").update(parts.join("|")).digest("hex");
}

function fields(): PayuIncomingFields {
  return {
    key: "key",
    txnid: "TXN12345",
    amount: "499.00",
    productinfo: "Order GAR-2026-000001",
    firstname: "Dhananjay",
    email: "d@example.com",
    udf1: "11111111-1111-4111-8111-111111111111",
    udf2: "",
    udf3: "",
    udf4: "",
    udf5: "",
    status: "success",
    hash: "",
  };
}

describe("PayU hashing", () => {
  it("formats and parses paise without floating point arithmetic", () => {
    expect(formatPaiseAsRupees(49_900)).toBe("499.00");
    expect(parseRupeesToPaise("499.00")).toBe(49_900);
    expect(parseRupeesToPaise("499.9")).toBe(49_990);
    expect(parseRupeesToPaise("499.999")).toBeNull();
  });

  it("creates the documented general-command hash", () => {
    expect(
      createCommandHash("key", "verify_payment", "TXN12345", "salt"),
    ).toMatch(/^[a-f0-9]{128}$/);
  });

  it("validates a standard reverse response hash", () => {
    const input = fields();
    const forward = createPaymentRequestHash({ ...input, salt: "salt" });
    expect(forward).toMatch(/^[a-f0-9]{128}$/);
    input.hash = responseHash(input, "salt");
    expect(verifyPaymentResponseHash(input, "salt")).toBe(true);
  });

  it("validates additional-charge and split-settlement hash variants", () => {
    const input = fields();
    input.additional_charges = "12.50";
    input.splitInfo = '{"splitStatus":"success"}';
    input.hash = responseHash(input, "salt", {
      additionalCharges: input.additional_charges,
      splitInfo: input.splitInfo,
    });
    expect(verifyPaymentResponseHash(input, "salt")).toBe(true);
  });

  it("fingerprints duplicate deliveries deterministically but keeps sources distinct", () => {
    const payload = { txnid: "TXN12345", status: "success" };
    expect(paymentEventFingerprint("callback", payload)).toBe(
      paymentEventFingerprint("callback", payload),
    );
    expect(paymentEventFingerprint("callback", payload)).not.toBe(
      paymentEventFingerprint("webhook", payload),
    );
  });

  it("rejects a tampered amount", () => {
    const input = fields();
    input.hash = responseHash(input, "salt");
    input.amount = "1.00";
    expect(verifyPaymentResponseHash(input, "salt")).toBe(false);
  });
});
