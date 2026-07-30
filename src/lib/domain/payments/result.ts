import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { getServerEnvironment } from "@/lib/config/env";

export const DURABLE_PAYMENT_RESULT_COOKIE = "garmops_payment_result";

const RESULT_MAX_AGE_MS = 60 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDER_NUMBER_PATTERN = /^(GAR|SAM)-\d{4}-\d{6}$/;

type Result = {
  version: 1;
  attemptId: string;
  orderNumber: string;
  outcome: "success" | "failure" | "pending";
  issuedAt: number;
};

function secret(): string {
  const environment = getServerEnvironment();
  const value = environment.PAYMENT_SIGNING_SECRET ?? environment.PAYU_SALT;
  if (!value) {
    throw new Error("Payment result signing is not configured");
  }
  return value;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createDurablePaymentResult(
  value: Omit<Result, "version" | "issuedAt">,
): string {
  const encoded = Buffer.from(
    JSON.stringify({
      version: 1,
      issuedAt: Date.now(),
      ...value,
    } satisfies Result),
  ).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function decodeDurablePaymentResult(token?: string): Result | null {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator < 1) return null;

  const encoded = token.slice(0, separator);
  const supplied = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(sign(encoded));
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return null;
  }

  try {
    const value = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<Result>;
    const now = Date.now();
    if (
      value.version !== 1 ||
      typeof value.attemptId !== "string" ||
      !UUID_PATTERN.test(value.attemptId) ||
      typeof value.orderNumber !== "string" ||
      !ORDER_NUMBER_PATTERN.test(value.orderNumber) ||
      !["success", "failure", "pending"].includes(String(value.outcome)) ||
      typeof value.issuedAt !== "number" ||
      value.issuedAt > now + CLOCK_SKEW_MS ||
      now - value.issuedAt > RESULT_MAX_AGE_MS
    ) {
      return null;
    }
    return value as Result;
  } catch {
    return null;
  }
}
