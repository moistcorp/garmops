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
  const invalidToken =
    typeof token !== "string" || token.length < 1 || token.length > 2048;
  if (invalidToken || !environment.TURNSTILE_SECRET) {
    console.warn("[turnstile] verification skipped", {
      tokenPresent: typeof token === "string" && token.length > 0,
      tokenLength: typeof token === "string" ? token.length : 0,
      secretConfigured: Boolean(environment.TURNSTILE_SECRET),
      expectedAction,
    });
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
    if (!response.ok) {
      const responseBody = await response.text();
      console.warn("[turnstile] siteverify HTTP failure", {
        status: response.status,
        expectedAction,
        responseBody: responseBody.slice(0, 500),
      });
      return false;
    }

    const expectedHostname = new URL(
      environment.NEXT_PUBLIC_APP_URL,
    ).hostname.toLowerCase();
    const result = (await response.json()) as TurnstileResponse;
    const accepted =
      result.success === true &&
      result.action === expectedAction &&
      result.hostname?.toLowerCase() === expectedHostname;

    if (!accepted) {
      console.warn("[turnstile] verification rejected", {
        success: result.success === true,
        action: result.action,
        expectedAction,
        hostname: result.hostname,
        expectedHostname,
        errorCodes: result["error-codes"],
      });
    }

    return accepted;
  } catch {
    return false;
  }
}
