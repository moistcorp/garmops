import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  readBoundedBody,
  readBoundedJson,
  RequestBodyError,
} from "./requestBody";

describe("bounded request bodies", () => {
  it("rejects an oversized body even when Content-Length is absent", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      body: "12345",
    });

    await expect(readBoundedBody(request, 4)).rejects.toMatchObject({
      code: "too_large",
    } satisfies Partial<RequestBodyError>);
  });

  it("rejects an oversized declared body before reading it", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "content-length": "100" },
      body: "{}",
    });

    await expect(readBoundedBody(request, 16)).rejects.toMatchObject({
      code: "too_large",
    } satisfies Partial<RequestBodyError>);
  });

  it("requires a JSON media type", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });

    await expect(readBoundedJson(request, 16)).rejects.toMatchObject({
      code: "unsupported_media_type",
    } satisfies Partial<RequestBodyError>);
  });

  it("parses a bounded JSON request", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: '{"ok":true}',
    });

    await expect(readBoundedJson(request, 64)).resolves.toEqual({ ok: true });
  });
});
