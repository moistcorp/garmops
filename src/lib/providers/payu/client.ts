import "server-only";

import { getServerEnvironment } from "@/lib/config/env";
import { createPaymentRequestHash, formatPaiseAsRupees } from "./hashing";
import type { PayuCheckoutFields } from "./types";

export function payuCheckoutUrl(): string {
  const env = getServerEnvironment();
  return env.NEXT_PUBLIC_PAYU_BASE_URL ?? (env.PAYU_ENVIRONMENT === "live"
    ? "https://secure.payu.in/_payment"
    : "https://test.payu.in/_payment");
}

export function buildPayuCheckout(input: {
  merchantTransactionId: string;
  paymentAttemptId: string;
  amountPaise: number;
  productInfo: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}): { checkoutUrl: string; fields: PayuCheckoutFields } {
  const env = getServerEnvironment();
  if (!env.PAYU_MERCHANT_KEY || !env.PAYU_SALT) throw new Error("PayU is not configured");
  const amount = formatPaiseAsRupees(input.amountPaise);
  const firstName =
    input.customerName.trim().split(/\s+/)[0]?.slice(0, 60) || "Customer";
  const phone = input.customerPhone.replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(phone)) {
    throw new Error("The saved customer phone number is invalid");
  }
  if (
    firstName.includes("|") ||
    input.productInfo.includes("|") ||
    input.customerEmail.includes("|")
  ) {
    throw new Error("The saved payment identity contains an unsupported character");
  }
  const callback = new URL("/api/payments/payu/callback", env.NEXT_PUBLIC_APP_URL).toString();
  const base = {
    key: env.PAYU_MERCHANT_KEY,
    txnid: input.merchantTransactionId,
    amount,
    productinfo: input.productInfo.slice(0, 200),
    firstname: firstName,
    email: input.customerEmail.toLowerCase(),
    udf1: input.paymentAttemptId,
    udf2: "",
    udf3: "",
    udf4: "",
    udf5: "",
  };
  return {
    checkoutUrl: payuCheckoutUrl(),
    fields: {
      ...base,
      phone,
      surl: callback,
      furl: callback,
      hash: createPaymentRequestHash({ ...base, salt: env.PAYU_SALT }),
    },
  };
}
