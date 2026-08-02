import "server-only";

import { createHash } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { getPrivateBucketName, getR2Client } from "@/lib/r2/client";
import { attachmentContentDisposition } from "@/lib/r2/downloadSafety";

const maximumAccountingPdfBytes = 20 * 1024 * 1024;

export type StoredPrivateObject = Readonly<{
  bucket: "garmops-private-orders";
  objectKey: string;
  byteSize: number;
  sha256: string;
  etag: string | null;
}>;

export async function putPrivatePdf(input: {
  objectKey: string;
  filename: string;
  bytes: Uint8Array;
  metadata?: Readonly<Record<string, string>>;
}): Promise<StoredPrivateObject> {
  if (!input.objectKey || input.objectKey.startsWith("/") || input.objectKey.includes("..")) {
    throw new Error("Invalid private object key");
  }
  if (
    input.bytes.length < 5 ||
    input.bytes.length > maximumAccountingPdfBytes ||
    Buffer.from(input.bytes.subarray(0, 5)).toString("ascii") !== "%PDF-"
  ) {
    throw new Error("Only validated PDF bytes may be stored as an accounting document");
  }

  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const result = await getR2Client().send(
    new PutObjectCommand({
      Bucket: getPrivateBucketName(),
      Key: input.objectKey,
      Body: input.bytes,
      ContentLength: input.bytes.length,
      ContentType: "application/pdf",
      ContentDisposition: attachmentContentDisposition(input.filename),
      CacheControl: "private, no-store, max-age=0",
      Metadata: {
        source: "garmops-invoice",
        sha256,
        ...(input.metadata ?? {}),
      },
    }),
  );

  return Object.freeze({
    bucket: getPrivateBucketName(),
    objectKey: input.objectKey,
    byteSize: input.bytes.length,
    sha256,
    etag: result.ETag?.trim() ?? null,
  });
}
