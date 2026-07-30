import { createHash, timingSafeEqual } from "node:crypto";
import type { PayuIncomingFields } from "./types";

function sha512(value: string): string {
  return createHash("sha512").update(value, "utf8").digest("hex");
}

export function formatPaiseAsRupees(paise: number): string {
  if (!Number.isSafeInteger(paise) || paise <= 0) throw new Error("Invalid paise amount");
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;
}

export function parseRupeesToPaise(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;
  const paise = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(paise) ? paise : null;
}

export function createPaymentRequestHash(input: {
  key: string; txnid: string; amount: string; productinfo: string; firstname: string;
  email: string; udf1?: string; udf2?: string; udf3?: string; udf4?: string; udf5?: string; salt: string;
}): string {
  return sha512([
    input.key, input.txnid, input.amount, input.productinfo, input.firstname, input.email,
    input.udf1 ?? "", input.udf2 ?? "", input.udf3 ?? "", input.udf4 ?? "", input.udf5 ?? "",
    "", "", "", "", "", input.salt,
  ].join("|"));
}

export function verifyPaymentResponseHash(fields: PayuIncomingFields, salt: string): boolean {
  const additional = fields.additional_charges ?? fields.additionalCharges;
  const parts = fields.splitInfo
    ? [
        salt, fields.status, fields.splitInfo, "", "", "", "", "", fields.udf5,
        fields.udf4, fields.udf3, fields.udf2, fields.udf1, fields.email, fields.firstname,
        fields.productinfo, fields.amount, fields.txnid, fields.key,
      ]
    : [
        salt, fields.status, "", "", "", "", "", fields.udf5, fields.udf4, fields.udf3,
        fields.udf2, fields.udf1, fields.email, fields.firstname, fields.productinfo, fields.amount,
        fields.txnid, fields.key,
      ];
  if (additional) parts.unshift(additional);
  const expected = sha512(parts.join("|"));
  const supplied = fields.hash.toLowerCase();
  if (!/^[a-f0-9]{128}$/.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"));
}

export function createCommandHash(key: string, command: string, var1: string, salt: string): string {
  return sha512(`${key}|${command}|${var1}|${salt}`);
}

export function paymentEventFingerprint(source: string, fields: Record<string, unknown>): string {
  const canonical = Object.keys(fields).sort().map((key) => `${key}=${String(fields[key] ?? "")}`).join("&");
  return createHash("sha256").update(`${source}|${canonical}`, "utf8").digest("hex");
}
