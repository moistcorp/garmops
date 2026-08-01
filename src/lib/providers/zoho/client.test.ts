import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ZohoClient } from "./client";

function clientReturning(response: Response): ZohoClient {
  const fetchImpl = vi.fn(async () => response) as unknown as typeof fetch;
  return new ZohoClient(
    "token",
    "https://www.zohoapis.in/invoice/v3",
    "organization",
    fetchImpl,
  );
}

describe("ZohoClient response boundaries", () => {
  it("rejects invalid JSON from a successful provider response", async () => {
    const client = clientReturning(
      new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(client.json("invoices")).rejects.toMatchObject({
      code: "ZOHO_INVALID_JSON_RESPONSE",
      retryable: true,
    });
  });

  it("preserves the HTTP error when an error response has invalid JSON", async () => {
    const client = clientReturning(
      new Response("upstream unavailable", { status: 503 }),
    );

    await expect(client.json("invoices")).rejects.toMatchObject({
      code: "ZOHO_HTTP_503",
      retryable: true,
      status: 503,
    });
  });
});
