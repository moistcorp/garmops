import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createPaymentResultCookie,
  createPaymentToken,
  decodePaymentResultCookie,
  decodePaymentToken,
} from "./payu";

const signingSecret = "test-payment-signing-secret";
let previousSecret: string | undefined;

beforeEach(() => {
  previousSecret = process.env.PAYMENT_SIGNING_SECRET;
  process.env.PAYMENT_SIGNING_SECRET = signingSecret;
});

afterEach(() => {
  if (previousSecret === undefined) delete process.env.PAYMENT_SIGNING_SECRET;
  else process.env.PAYMENT_SIGNING_SECRET = previousSecret;
});

function signed(value: object): string {
  const encoded = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = createHmac("sha256", signingSecret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

describe("legacy PayU hand-off identity", () => {
  it("binds the initiating customer identity into the signed token", () => {
    const token = createPaymentToken(
      "MF123",
      "499.00",
      "configurator",
      "Asha",
      "ASHA@EXAMPLE.COM",
    );

    expect(token).not.toBeNull();
    expect(decodePaymentToken(token!)).toMatchObject({
      version: 2,
      firstname: "Asha",
      email: "asha@example.com",
    });
  });

  it("rejects an older token that does not bind customer identity", () => {
    const token = signed({
      version: 1,
      txnid: "MF123",
      amount: "499.00",
      kind: "configurator",
      issuedAt: Date.now(),
    });

    expect(decodePaymentToken(token)).toBeNull();
  });

  it("preserves the bound identity in the signed result cookie", () => {
    const token = createPaymentToken(
      "MF123",
      "499.00",
      "configurator",
      "Asha",
      "asha@example.com",
    );
    const payment = decodePaymentToken(token!);
    expect(payment).not.toBeNull();

    const cookie = createPaymentResultCookie(payment!, "success");
    expect(decodePaymentResultCookie(cookie!)).toMatchObject({
      status: "success",
      firstname: "Asha",
      email: "asha@example.com",
    });
  });
});
