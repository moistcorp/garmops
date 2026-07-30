import "server-only";

import { getServerEnvironment } from "@/lib/config/env";
import { createCommandHash } from "./hashing";
import type { PayuVerificationResult } from "./types";

import { parsePayuVerificationResponse } from "./verificationResult";

export { parsePayuVerificationResponse } from "./verificationResult";

export async function verifyPayuPayment(
  transactionId: string,
): Promise<PayuVerificationResult> {
  const env = getServerEnvironment();
  if (!env.PAYU_MERCHANT_KEY || !env.PAYU_SALT) {
    throw new Error("PayU verification is not configured");
  }

  const command = "verify_payment";
  const endpoint =
    env.PAYU_VERIFY_BASE_URL ??
    (env.PAYU_ENVIRONMENT === "live"
      ? "https://info.payu.in/merchant/postservice.php?form=2"
      : "https://test.payu.in/merchant/postservice.php?form=2");
  const body = new URLSearchParams({
    key: env.PAYU_MERCHANT_KEY,
    command,
    var1: transactionId,
    hash: createCommandHash(
      env.PAYU_MERCHANT_KEY,
      command,
      transactionId,
      env.PAYU_SALT,
    ),
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`PayU verification returned ${response.status}`);
  }

  return parsePayuVerificationResponse(await response.json(), transactionId);
}
