import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  checkoutAttempt: null as unknown,
  legacyAttempt: null as unknown,
  from: vi.fn(),
}));

vi.mock("@/lib/config/env", () => ({
  getServerEnvironment: () => ({
    PAYU_MERCHANT_KEY: "merchant-key",
    PAYU_SALT: "salt",
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: state.from,
  }),
}));

import { isPayuResponseCryptographicallyAuthentic } from "./processPayuEvent";
import { processPayuEvent } from "./processPayuEvent";
import type { PayuIncomingFields } from "@/lib/providers/payu/types";

function fields(): PayuIncomingFields {
  return {
    key: "merchant-key",
    txnid: "TXN-1",
    amount: "499.00",
    productinfo: "Sample order",
    firstname: "Asha",
    email: "asha@example.com",
    udf1: "attempt-1",
    udf2: "",
    udf3: "",
    udf4: "",
    udf5: "",
    status: "success",
    hash: "",
  };
}

function responseHash(input: PayuIncomingFields, salt: string): string {
  return createHash("sha512")
    .update([
      salt,
      input.status,
      "",
      "",
      "",
      "",
      "",
      input.udf5,
      input.udf4,
      input.udf3,
      input.udf2,
      input.udf1,
      input.email,
      input.firstname,
      input.productinfo,
      input.amount,
      input.txnid,
      input.key,
    ].join("|"))
    .digest("hex");
}

function queryFor(table: string) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({
    data:
      table === "checkout_payment_attempts"
        ? state.checkoutAttempt
        : state.legacyAttempt,
    error: null,
  });
  return query;
}

const checkoutAttempt = {
  id: "checkout-attempt-1",
  checkout_session_id: "checkout-session-1",
  amount_paise: 49900,
  currency: "INR",
  provider_merchant_txn_id: "TXN-1",
  expected_product_info: "Sample order",
  customer_email: "asha@example.com",
  customer_name: "Asha",
  status: "initiated",
  provider_payment_id: null,
  raw_verified_snapshot: null,
  checkout_sessions: {
    id: "checkout-session-1",
    cart_id: "cart-1",
    return_path: "/checkout",
    status: "payment_pending",
    final_order_number: null,
    final_payment_attempt_id: null,
    customer_user_id: "user-1",
    flow: "sample_purchase",
  },
};

const legacyAttempt = {
  id: "payment-attempt-1",
  order_id: "order-1",
  amount_paise: 49900,
  currency: "INR",
  provider_merchant_txn_id: "TXN-1",
  purpose: "order_full",
  expected_product_info: "Sample order",
  customer_email: "asha@example.com",
  customer_name: "Asha",
  orders: { order_number: "GAR-2026-000001", customer_user_id: "user-1" },
};

beforeEach(() => {
  state.checkoutAttempt = null;
  state.legacyAttempt = null;
  state.from.mockReset();
  state.from.mockImplementation((table: string) => {
    if (table === "checkout_payment_attempts" || table === "payment_attempts") {
      return queryFor(table);
    }
    throw new Error(`Unexpected persistence table: ${table}`);
  });
});

describe("PayU callback authenticity precheck", () => {
  it("does not insert an unauthenticated checkout callback", async () => {
    state.checkoutAttempt = checkoutAttempt;
    await expect(processPayuEvent("callback", fields())).rejects.toThrow(
      "Invalid PayU response hash",
    );
    expect(state.from).not.toHaveBeenCalledWith("checkout_payment_events");
  });

  it("does not insert an unauthenticated legacy callback", async () => {
    state.legacyAttempt = legacyAttempt;
    await expect(processPayuEvent("callback", fields())).rejects.toThrow(
      "Invalid PayU response hash",
    );
    expect(state.from).not.toHaveBeenCalledWith("payment_events");
  });

  it("rejects an invalid hash before persistence can be attempted", () => {
    expect(
      isPayuResponseCryptographicallyAuthentic(fields(), {
        PAYU_MERCHANT_KEY: "merchant-key",
        PAYU_SALT: "salt",
      }),
    ).toBe(false);
  });

  it("accepts a valid hash only for the configured merchant key", () => {
    const input = fields();
    input.hash = responseHash(input, "salt");
    expect(
      isPayuResponseCryptographicallyAuthentic(input, {
        PAYU_MERCHANT_KEY: "merchant-key",
        PAYU_SALT: "salt",
      }),
    ).toBe(true);
    expect(
      isPayuResponseCryptographicallyAuthentic(input, {
        PAYU_MERCHANT_KEY: "wrong-key",
        PAYU_SALT: "salt",
      }),
    ).toBe(false);
  });
});
