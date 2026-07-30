import "server-only";

import { getServerEnvironment } from "@/lib/config/env";
import { ZohoProviderError } from "@/lib/providers/zoho/errors";

export type ZohoAccessToken = Readonly<{
  accessToken: string;
  apiDomain: string | null;
  expiresIn: number;
}>;

type CachedZohoAccessToken = Readonly<{
  token: ZohoAccessToken;
  expiresAt: number;
}>;

let cachedAccessToken: CachedZohoAccessToken | undefined;
let tokenRefreshInFlight: Promise<ZohoAccessToken> | undefined;

async function requestZohoAccessToken(
  fetchImpl: typeof fetch = fetch,
): Promise<ZohoAccessToken> {
  const environment = getServerEnvironment();
  if (
    !environment.ZOHO_ACCOUNTS_BASE_URL ||
    !environment.ZOHO_CLIENT_ID ||
    !environment.ZOHO_CLIENT_SECRET ||
    !environment.ZOHO_REFRESH_TOKEN
  ) {
    throw new ZohoProviderError({
      code: "ZOHO_OAUTH_CONFIGURATION_REQUIRED",
      message: "Zoho OAuth configuration is incomplete",
      safeMessage: "Zoho OAuth setup requires finance or administrator attention.",
      retryable: false,
    });
  }

  const endpoint = new URL("oauth/v2/token", `${environment.ZOHO_ACCOUNTS_BASE_URL.replace(/\/$/, "")}/`);
  const body = new URLSearchParams({
    client_id: environment.ZOHO_CLIENT_ID,
    client_secret: environment.ZOHO_CLIENT_SECRET,
    refresh_token: environment.ZOHO_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });

  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new ZohoProviderError({
      code: "ZOHO_OAUTH_NETWORK_ERROR",
      message: "Zoho OAuth request failed",
      safeMessage: "Zoho authentication is temporarily unavailable.",
      retryable: true,
      cause: error,
    });
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const accessToken = typeof payload.access_token === "string" ? payload.access_token : null;
  if (!response.ok || !accessToken) {
    const providerCode = typeof payload.error === "string" ? payload.error : "oauth_error";
    throw new ZohoProviderError({
      code: `ZOHO_OAUTH_${providerCode.toUpperCase()}`,
      message: `Zoho OAuth failed (${response.status}): ${providerCode}`,
      safeMessage: response.status >= 500
        ? "Zoho authentication is temporarily unavailable."
        : "Zoho OAuth credentials require administrator attention.",
      retryable: response.status === 429 || response.status >= 500,
      status: response.status,
    });
  }

  return Object.freeze({
    accessToken,
    apiDomain: typeof payload.api_domain === "string" ? payload.api_domain : null,
    expiresIn:
      typeof payload.expires_in === "number"
        ? payload.expires_in
        : typeof payload.expires_in === "string" && /^\d+$/.test(payload.expires_in)
          ? Number(payload.expires_in)
          : 3600,
  });
}

/**
 * Returns a process-local cached access token. Vercel instances may be short-lived,
 * so the refresh token remains authoritative, while caching prevents one refresh
 * request for every Zoho API call or concurrently claimed invoice job.
 */
export async function exchangeZohoRefreshToken(
  fetchImpl: typeof fetch = fetch,
): Promise<ZohoAccessToken> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt - now > 60_000) {
    return cachedAccessToken.token;
  }

  tokenRefreshInFlight ??= requestZohoAccessToken(fetchImpl)
    .then((token) => {
      cachedAccessToken = Object.freeze({
        token,
        expiresAt: Date.now() + Math.max(1, token.expiresIn) * 1000,
      });
      return token;
    })
    .finally(() => {
      tokenRefreshInFlight = undefined;
    });

  return tokenRefreshInFlight;
}

export function clearZohoAccessTokenCache(): void {
  cachedAccessToken = undefined;
  tokenRefreshInFlight = undefined;
}


export const clearZohoAccessTokenCacheForTests = clearZohoAccessTokenCache;
