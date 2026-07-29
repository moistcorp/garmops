import type { HeadObjectCommandOutput } from "@aws-sdk/client-s3";

export type ObjectVerificationInput = Readonly<{
  fileId: string;
  expectedByteSize: number;
  expectedSha256: string | null;
}>;

export type VerifiedObject = Readonly<{
  byteSize: number;
  contentType: string;
  etag: string;
  sha256: string | null;
}>;

function sha256Hex(base64: string | undefined): string | null {
  if (!base64) return null;
  const bytes = Buffer.from(base64, "base64");
  return bytes.length === 32 ? bytes.toString("hex") : null;
}

export function verifyPrivateObjectHead(
  input: ObjectVerificationInput,
  object: HeadObjectCommandOutput,
): VerifiedObject | null {
  const etag = object.ETag?.trim();
  const contentType = object.ContentType?.trim().toLowerCase();
  const sha256 = sha256Hex(object.ChecksumSHA256);
  const metadata = object.Metadata ?? {};

  if (
    typeof object.ContentLength !== "number" ||
    !contentType ||
    !etag ||
    metadata["file-id"] !== input.fileId ||
    metadata["expected-size"] !== String(input.expectedByteSize) ||
    object.ContentLength !== input.expectedByteSize ||
    (input.expectedSha256 !== null &&
      (metadata["expected-sha256"] !== input.expectedSha256 ||
        sha256 !== input.expectedSha256))
  ) {
    return null;
  }

  return Object.freeze({
    byteSize: object.ContentLength,
    contentType,
    etag,
    sha256,
  });
}
