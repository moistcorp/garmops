import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("configurator sample asset route", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads an allowlisted sample asset on the server", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("<svg></svg>", {
        headers: { "content-type": "image/svg+xml" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("https://garmops.com"), {
      params: Promise.resolve({ filename: "artwork-sample.svg" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(await response.text()).toBe("<svg></svg>");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://assets.garmops.com/garments/v5/artwork-sample.svg",
      { cache: "force-cache" },
    );
  });

  it("rejects assets outside the sample allowlist", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("https://garmops.com"), {
      params: Promise.resolve({ filename: "other.svg" }),
    });

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
