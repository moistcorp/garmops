import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  medusaRequest: vi.fn(),
}));

vi.mock("@/lib/medusa/client", () => ({
  medusaRequest: mocks.medusaRequest,
}));

import { POST } from "./route";

function uploadRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/uploads/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("artwork upload BFF contract", () => {
  beforeEach(() => {
    mocks.medusaRequest.mockResolvedValue({
      fileId: "file_1",
      uploadUrl: "https://presigned.example/file_1",
      expiresIn: 900,
      state: "pending",
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("forwards only the backend upload schema fields", async () => {
    const response = await POST(uploadRequest({
      filename: "front artwork final.png",
      contentType: "image/png",
      byteSize: 4_000_000,
      sha256: "a".repeat(64),
      kind: "customer_artwork",
      designProjectId: "dp_1",
    }));

    expect(response.status).toBe(201);
    expect(mocks.medusaRequest).toHaveBeenCalledTimes(1);
    const [path, options] = mocks.medusaRequest.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(path).toBe("/store/garmops/files/upload");
    expect(options.body).toEqual({
      filename: "front artwork final.png",
      contentType: "image/png",
      byteSize: 4_000_000,
      sha256: "a".repeat(64),
      kind: "customer_artwork",
      visibility: "customer",
      designProjectId: "dp_1",
      orderId: undefined,
    });
    expect(options.body).not.toHaveProperty("safeFilename");
    expect(options.body).not.toHaveProperty("extension");
  });

  it("never sends backend-derived fields even when the client supplies them", async () => {
    const response = await POST(uploadRequest({
      filename: "front artwork final.png",
      safeFilename: "front artwork final.png",
      contentType: "image/png",
      byteSize: 4_000_000,
      extension: "png",
      kind: "customer_artwork",
      designProjectId: "dp_1",
    }));

    expect(response.status).toBe(201);
    const [, options] = mocks.medusaRequest.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(options.body).not.toHaveProperty("safeFilename");
    expect(options.body).not.toHaveProperty("extension");
  });

  it("maps a backend failure to a 503 upload target error", async () => {
    mocks.medusaRequest.mockRejectedValueOnce(new Error("boom"));
    const response = await POST(uploadRequest({ kind: "customer_artwork", filename: "a.png", contentType: "image/png", byteSize: 1 }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Upload target is unavailable" });
  });
});