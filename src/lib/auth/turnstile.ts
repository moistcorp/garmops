import "server-only";

import { randomUUID } from "node:crypto";
import { getServerEnvironment } from "@/lib/config/env";

type TurnstileResponse = {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

export async function verifyTurnstile(
  token: FormDataEntryValue | null,
  expectedAction: string,
  remoteIp?: string,
) {
  const environment = getServerEnvironment();
  if (
    typeof token !== "string" ||
    token.length < 1 ||
    token.length > 2048 ||
    !environment.TURNSTILE_SECRET
  ) {
    return false;
  }

  const form = new URLSearchParams({
    secret: environment.TURNSTILE_SECRET,
    response: token,
    idempotency_key: randomUUID(),
  });
  if (remoteIp && remoteIp !== "unknown") form.set("remoteip", remoteIp);

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: form,
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) return false;

    const result = (await response.json()) as TurnstileResponse;
    if (result.success !== true || result.action !== expectedAction) return false;

    const expectedHostname = new URL(
      environment.NEXT_PUBLIC_APP_URL,
    ).hostname.toLowerCase();
    return result.hostname?.toLowerCase() === expectedHostname;
  } catch {
    return false;
  }
}
