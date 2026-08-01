import "server-only";

import { getServerEnvironment } from "@/lib/config/env";
import { clearZohoAccessTokenCache, exchangeZohoRefreshToken } from "@/lib/providers/zoho/auth";
import { ZohoProviderError } from "@/lib/providers/zoho/errors";
import type { ZohoApiEnvelope } from "@/lib/providers/zoho/types";
import { readBoundedBody, RequestBodyError } from "@/lib/http/requestBody";

const maximumJsonBytes = 2 * 1024 * 1024;
const maximumPdfBytes = 20 * 1024 * 1024;

export class ZohoClient {
  constructor(
    private accessToken: string,
    private readonly apiBaseUrl: string,
    private readonly organizationId: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private url(path: string, query?: URLSearchParams): URL {
    const normalizedBase = `${this.apiBaseUrl.replace(/\/$/, "")}/`;
    const url = new URL(path.replace(/^\//, ""), normalizedBase);
    if (query) url.search = query.toString();
    return url;
  }

  private async request(path: string, init: RequestInit, query?: URLSearchParams): Promise<Response> {
    const execute = async (): Promise<Response> => this.fetchImpl(this.url(path, query), {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
      headers: {
        Authorization: `Zoho-oauthtoken ${this.accessToken}`,
        "X-com-zoho-invoice-organizationid": this.organizationId,
        ...(init.headers ?? {}),
      },
    });

    try {
      let response = await execute();
      if (response.status === 401) {
        clearZohoAccessTokenCache();
        const refreshed = await exchangeZohoRefreshToken(this.fetchImpl);
        this.accessToken = refreshed.accessToken;
        response = await execute();
      }
      return response;
    } catch (error) {
      if (error instanceof ZohoProviderError) throw error;
      throw new ZohoProviderError({
        code: "ZOHO_NETWORK_ERROR",
        message: `Zoho request failed: ${path}`,
        safeMessage: "Zoho Invoice is temporarily unreachable.",
        retryable: true,
        cause: error,
      });
    }
  }

  async json<T extends ZohoApiEnvelope>(
    path: string,
    options: { method?: "GET" | "POST" | "PUT"; body?: unknown; query?: URLSearchParams } = {},
  ): Promise<T> {
    const response = await this.request(
      path,
      {
        method: options.method ?? "GET",
        headers: options.body === undefined ? undefined : { "content-type": "application/json" },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      },
      options.query,
    );
    let payload = {} as T;
    let parseError: unknown;
    try {
      const bytes = await readBoundedBody(response, maximumJsonBytes);
      payload = JSON.parse(bytes.toString("utf8")) as T;
    } catch (error) {
      parseError = error;
    }
    if (response.ok && parseError) {
      throw new ZohoProviderError({
        code:
          parseError instanceof RequestBodyError && parseError.code === "too_large"
            ? "ZOHO_JSON_TOO_LARGE"
            : "ZOHO_INVALID_JSON_RESPONSE",
        message: `Zoho returned an invalid JSON response (${path})`,
        safeMessage: "Zoho returned an invalid accounting response.",
        retryable: true,
        status: response.status,
        cause: parseError,
      });
    }
    const providerCode = typeof payload.code === "number" ? payload.code : null;
    if (!response.ok || (providerCode !== null && providerCode !== 0)) {
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      const message = typeof payload.message === "string" ? payload.message : "Zoho API request failed";
      throw new ZohoProviderError({
        code: providerCode === null ? `ZOHO_HTTP_${response.status}` : `ZOHO_${providerCode}`,
        message: `${message} (${path})`,
        safeMessage: retryable
          ? "Zoho Invoice is temporarily unavailable."
          : "Zoho rejected the accounting request. Finance review is required.",
        retryable,
        status: response.status,
      });
    }
    return payload;
  }

  async binary(path: string, query?: URLSearchParams): Promise<Uint8Array> {
    const response = await this.request(path, { method: "GET" }, query);
    if (!response.ok) {
      throw new ZohoProviderError({
        code: `ZOHO_PDF_HTTP_${response.status}`,
        message: `Zoho PDF request failed (${response.status})`,
        safeMessage: response.status >= 500
          ? "The official invoice PDF is temporarily unavailable."
          : "Zoho could not provide the official invoice PDF.",
        retryable: response.status === 408 || response.status === 429 || response.status >= 500,
        status: response.status,
      });
    }
    let bytes: Uint8Array;
    try {
      bytes = await readBoundedBody(response, maximumPdfBytes);
    } catch (error) {
      throw new ZohoProviderError({
        code:
          error instanceof RequestBodyError && error.code === "too_large"
            ? "ZOHO_PDF_TOO_LARGE"
            : "ZOHO_PDF_READ_FAILED",
        message: "Zoho PDF response could not be read safely",
        safeMessage: "Zoho returned an invalid accounting document.",
        retryable: true,
        cause: error,
      });
    }
    if (bytes.length < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
      throw new ZohoProviderError({
        code: "ZOHO_INVALID_PDF",
        message: "Zoho returned a non-PDF document",
        safeMessage: "Zoho returned an invalid accounting document.",
        retryable: true,
      });
    }
    return bytes;
  }
}

export async function createZohoClient(fetchImpl: typeof fetch = fetch): Promise<ZohoClient> {
  const environment = getServerEnvironment();
  if (!environment.ZOHO_INVOICE_API_BASE_URL || !environment.ZOHO_ORGANIZATION_ID) {
    throw new ZohoProviderError({
      code: "ZOHO_API_CONFIGURATION_REQUIRED",
      message: "Zoho API configuration is incomplete",
      safeMessage: "Zoho API setup requires administrator attention.",
      retryable: false,
    });
  }
  const token = await exchangeZohoRefreshToken(fetchImpl);
  return new ZohoClient(
    token.accessToken,
    environment.ZOHO_INVOICE_API_BASE_URL,
    environment.ZOHO_ORGANIZATION_ID,
    fetchImpl,
  );
}
