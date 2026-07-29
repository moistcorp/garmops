import { describe, expect, it } from "vitest";

import { verifyPrivateObjectHead } from "./objectVerification";

const fileId = "aaaaaaaa-1111-4111-8111-111111111111";
const sha256 = "a".repeat(64);
const checksum = Buffer.from(sha256, "hex").toString("base64");

const validHead = {
  $metadata: {},
  ContentLength: 4096,
  ContentType: "image/svg+xml",
  ETag: '"verified-etag"',
  ChecksumSHA256: checksum,
  Metadata: {
    "file-id": fileId,
    "expected-size": "4096",
    "expected-sha256": sha256,
  },
};

describe("R2 object finalization verification", () => {
  it("accepts exact signed metadata, object size, type, ETag, and checksum", () => {
    expect(
      verifyPrivateObjectHead(
        {
          fileId,
          expectedByteSize: 4096,
          expectedSha256: sha256,
        },
        validHead,
      ),
    ).toEqual({
      byteSize: 4096,
      contentType: "image/svg+xml",
      etag: '"verified-etag"',
      sha256,
    });
  });

  it("rejects a byte-size or signed metadata mismatch", () => {
    expect(
      verifyPrivateObjectHead(
        {
          fileId,
          expectedByteSize: 4096,
          expectedSha256: sha256,
        },
        { ...validHead, ContentLength: 4095 },
      ),
    ).toBeNull();
    expect(
      verifyPrivateObjectHead(
        {
          fileId,
          expectedByteSize: 4096,
          expectedSha256: sha256,
        },
        {
          ...validHead,
          Metadata: { ...validHead.Metadata, "file-id": crypto.randomUUID() },
        },
      ),
    ).toBeNull();
  });

  it("rejects a missing or different required SHA-256 checksum", () => {
    expect(
      verifyPrivateObjectHead(
        {
          fileId,
          expectedByteSize: 4096,
          expectedSha256: sha256,
        },
        { ...validHead, ChecksumSHA256: undefined },
      ),
    ).toBeNull();
    expect(
      verifyPrivateObjectHead(
        {
          fileId,
          expectedByteSize: 4096,
          expectedSha256: sha256,
        },
        {
          ...validHead,
          ChecksumSHA256: Buffer.alloc(32, 0xff).toString("base64"),
        },
      ),
    ).toBeNull();
  });
});
