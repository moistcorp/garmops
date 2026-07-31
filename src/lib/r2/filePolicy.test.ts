import { describe, expect, it } from "vitest";

import { validateUploadRequest } from "./filePolicy";

const validArtwork = {
  orderId: "aaaaaaaa-1111-4111-8111-111111111111",
  kind: "customer_artwork",
  visibility: "customer",
  filename: "Brand Artwork.svg",
  contentType: "image/svg+xml",
  byteSize: 1024,
};

describe("private upload policy", () => {
  it("accepts a supported artwork and derives only display metadata", () => {
    const result = validateUploadRequest(validArtwork);

    expect(result).toEqual({
      ok: true,
      value: {
        orderId: validArtwork.orderId,
        kind: "customer_artwork",
        visibility: "customer",
        originalFilename: "Brand Artwork.svg",
        safeFilename: "Brand Artwork.svg",
        extension: "svg",
        contentType: "image/svg+xml",
        byteSize: 1024,
      },
    });
    expect(JSON.stringify(result)).not.toContain("objectKey");
  });

  it("rejects path-like and bidirectional-control filenames", () => {
    expect(
      validateUploadRequest({
        ...validArtwork,
        filename: "../private.svg",
      }),
    ).toEqual({ ok: false, error: "Invalid filename" });
    expect(
      validateUploadRequest({
        ...validArtwork,
        filename: "invoice\u202Efdp.svg",
      }),
    ).toEqual({ ok: false, error: "Invalid filename" });
  });

  it("requires exactly one order or design target", () => {
    expect(
      validateUploadRequest({
        ...validArtwork,
        designProjectId: "bbbbbbbb-2222-4222-8222-222222222222",
      }),
    ).toEqual({ ok: false, error: "Invalid upload request" });
  });

  it("rejects MIME/extension mismatches and browser-system files", () => {
    expect(
      validateUploadRequest({
        ...validArtwork,
        contentType: "text/html",
      }),
    ).toEqual({ ok: false, error: "File type is not allowed" });
    expect(
      validateUploadRequest({
        ...validArtwork,
        kind: "approval_pdf",
        filename: "approval.pdf",
        contentType: "application/pdf",
      }),
    ).toEqual({ ok: false, error: "Invalid upload request" });
  });

  it("accepts hashed PDF-only approval evidence", () => {
    expect(
      validateUploadRequest({
        ...validArtwork,
        kind: "approval_pdf",
        filename: "approval.pdf",
        contentType: "application/pdf",
        sha256: "a".repeat(64),
      }),
    ).toMatchObject({
      ok: true,
      value: {
        kind: "approval_pdf",
        extension: "pdf",
        contentType: "application/pdf",
        sha256: "a".repeat(64),
      },
    });
    expect(
      validateUploadRequest({
        ...validArtwork,
        kind: "approval_pdf",
        filename: "approval.svg",
        contentType: "image/svg+xml",
        sha256: "a".repeat(64),
      }),
    ).toEqual({ ok: false, error: "File type is not allowed" });
  });

  it("enforces the per-kind byte limit", () => {
    expect(
      validateUploadRequest({
        ...validArtwork,
        byteSize: 50 * 1024 * 1024 + 1,
      }),
    ).toEqual({ ok: false, error: "File is too large" });
  });

  it("normalizes a display filename without changing its extension", () => {
    const result = validateUploadRequest({
      ...validArtwork,
      filename: "Logo—Final (approved).SVG",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        originalFilename: "Logo—Final (approved).SVG",
        safeFilename: "Logo_Final (approved).svg",
        extension: "svg",
      },
    });
  });
});
