import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnvironment } from "@/lib/config/env";

export type AuthRateLimitScope =
  | "register"
  | "login"
  | "forgot_password"
  | "resend_verification"
  | "contact"
  | "mfa"
  | "staff_invite";

const RULES: Record<
  AuthRateLimitScope,
  { maxAttempts: number; windowSeconds: number }
> = {
  register: { maxAttempts: 4, windowSeconds: 3600 },
  login: { maxAttempts: 10, windowSeconds: 600 },
  forgot_password: { maxAttempts: 4, windowSeconds: 3600 },
  resend_verification: { maxAttempts: 4, windowSeconds: 3600 },
  contact: { maxAttempts: 3, windowSeconds: 600 },
  mfa: { maxAttempts: 10, windowSeconds: 600 },
  staff_invite: { maxAttempts: 20, windowSeconds: 3600 },
};

export async function requestIpAddress() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function consumeAuthRateLimit(
  scope: AuthRateLimitScope,
  subject: string,
) {
  const environment = getServerEnvironment();
  if (!environment.AUTH_RATE_LIMIT_SALT) {
    throw new Error("Authentication rate limiting is unavailable");
  }

  const ip = await requestIpAddress();
  const subjectHash = createHmac("sha256", environment.AUTH_RATE_LIMIT_SALT)
    .update(`${scope}\n${ip}\n${subject.trim().toLowerCase()}`)
    .digest("hex");
  const rule = RULES[scope];
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_auth_rate_limit", {
    p_scope: scope,
    p_subject_hash: subjectHash,
    p_max_attempts: rule.maxAttempts,
    p_window_seconds: rule.windowSeconds,
  });

  if (error || !data?.[0]) {
    throw new Error("Authentication rate limiting failed closed");
  }

  return data[0];
}
