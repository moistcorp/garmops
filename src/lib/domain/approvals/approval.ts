import "server-only";

import { createHash, createHmac, randomBytes } from "node:crypto";
import { getServerEnvironment } from "@/lib/config/env";

export function createApprovalToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashApprovalToken(token) };
}

export function hashApprovalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashApprovalNetworkValue(value: string | null) {
  if (!value) return null;
  const secret = getServerEnvironment().AUTH_RATE_LIMIT_SALT;
  if (!secret) return null;
  return createHmac("sha256", secret).update(value).digest("hex");
}
