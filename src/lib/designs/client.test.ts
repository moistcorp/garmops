import { afterEach, describe, expect, it, vi } from "vitest";
import type { BuildDraft } from "@/lib/configurator/buildDraft";
import { saveBuildDraftToCloud } from "./client";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function sampleDraft(fileUrl: string): BuildDraft {
  return {
    version: 1,
    savedAt: "2026-08-16T04:51:00.000Z",
    colour: {
      type: "signature",
      id: "classic-white",
      name: "Classic White",
      hex: "#ffffff",
      confirmed: true,
    },
    artwork: {
      front: {
        fileUrl,
        fileType: "svg",
        vectorized: true,
        technique: "screen_print",
        width: 20,
        height: 3,
        fromNeck: 8,
        fromCenter: 0,
        printArea: "M",
        guidelines: { maximumArea: true, leftChest: false },
        confirmed: true,
      },
    },
    neckLabel: {
      labelType: "standard-size",
      fileUrl: "",
      dimensions: "50x18",
      position: "below_neck_tape",
      stitch: "2_corner",
      confirmed: true,
    },
    steps: [
      { id: "garment-colour", title: "Garment colour", summary: "Classic White", confirmed: true },
      { id: "artwork", title: "Artwork", summary: "Front", confirmed: true },
      { id: "neck-label", title: "Neck label", summary: "Standard size label", confirmed: true },
    ],
    quantity: 50,
  };
}

describe("cloud design artwork ownership", () => {
  afterEach(() => vi.restoreAllMocks());

  it("copies public sample artwork into a server-owned upload before saving the cart version", async () => {
    const sampleUrl = "https://assets.garmops.com/garments/v1/artwork-sample.svg";
    const fileId = "11111111-1111-4111-8111-111111111111";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({
        design: {
          id: "design_123",
          draftRevision: 1,
          currentVersion: 1,
          currentVersionId: "version_1",
          lastSavedAt: "2026-08-16T04:51:00.000Z",
        },
      }, 201))
      .mockResolvedValueOnce(new Response("<svg></svg>", {
        headers: { "content-type": "image/svg+xml" },
      }))
      .mockResolvedValueOnce(json({
        fileId,
        upload: {
          url: "https://uploads.example.test/artwork",
          method: "PUT",
          headers: { "Content-Type": "image/svg+xml" },
        },
        finalizeUrl: `/api/uploads/${fileId}/finalize`,
      }, 201))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(json({ fileId, uploadStatus: "uploaded" }))
      .mockResolvedValueOnce(json({
        design: {
          draftRevision: 2,
          currentVersion: 2,
          currentVersionId: "version_2",
          lastSavedAt: "2026-08-16T04:52:00.000Z",
        },
      }))
      .mockResolvedValueOnce(json({
        version: {
          id: "version_2",
          number: 2,
          draftRevision: 2,
          createdAt: "2026-08-16T04:52:00.000Z",
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveBuildDraftToCloud({
      configId: "regular-fit-tee-200gsm",
      productName: "Classic T-Shirt",
      draft: sampleDraft(sampleUrl),
      existingLink: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.uploadedDraft.artwork.front?.fileId).toBe(fileId);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/designs",
      "/api/configurator/sample-assets/artwork-sample.svg",
      "/api/uploads/create",
      "https://uploads.example.test/artwork",
      `/api/uploads/${fileId}/finalize`,
      "/api/designs/design_123",
      "/api/designs/design_123/versions",
    ]);
    const patchBody = JSON.parse(String(fetchMock.mock.calls[5]?.[1]?.body));
    expect(patchBody.snapshot.configuration.artwork.front.fileId).toBe(fileId);
  });
});
