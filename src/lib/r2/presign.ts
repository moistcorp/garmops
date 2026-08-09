import "server-only";

import {
  ChecksumMode,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getPrivateBucketName, getR2Client } from "@/lib/r2/client";
import { attachmentContentDisposition } from "@/lib/r2/downloadSafety";
import {
  verifyPrivateObjectHead,
  type VerifiedObject,
} from "@/lib/r2/objectVerification";

const uploadLifetimeSeconds = 7 * 60;
const downloadLifetimeSeconds = 3 * 60;

type UploadSigningInput = Readonly<{
  fileId: string;
  objectKey: string;
  contentType: string;
  byteSize: number;
  sha256?: string;
}>;

export type PresignedUpload = Readonly<{
  url: string;
  method: "PUT";
  expiresIn: number;
  headers: Readonly<Record<string, string>>;
}>;

function sha256Base64(hex: string): string {
  return Buffer.from(hex, "hex").toString("base64");
}

export async function createPresignedUpload(
  input: UploadSigningInput,
): Promise<PresignedUpload> {
  const metadata: Record<string, string> = {
    "file-id": input.fileId,
    "expected-size": String(input.byteSize),
  };
  if (input.sha256) metadata["expected-sha256"] = input.sha256;

  const headers: Record<string, string> = {
    "content-type": input.contentType,
    "x-amz-meta-file-id": input.fileId,
    "x-amz-meta-expected-size": String(input.byteSize),
  };
  const unhoistableHeaders = new Set<string>([
    "x-amz-meta-file-id",
    "x-amz-meta-expected-size",
  ]);

  if (input.sha256) {
    headers["x-amz-meta-expected-sha256"] = input.sha256;
    headers["x-amz-checksum-sha256"] = sha256Base64(input.sha256);
    unhoistableHeaders.add("x-amz-meta-expected-sha256");
    unhoistableHeaders.add("x-amz-checksum-sha256");
  }

  const command = new PutObjectCommand({
    Bucket: getPrivateBucketName(),
    Key: input.objectKey,
    ContentType: input.contentType,
    Metadata: metadata,
    ...(input.sha256
      ? {
          ChecksumSHA256: sha256Base64(input.sha256),
        }
      : {}),
  });

  const url = await getSignedUrl(getR2Client(), command, {
    expiresIn: uploadLifetimeSeconds,
    unhoistableHeaders,
  });

  return Object.freeze({
    url,
    method: "PUT" as const,
    expiresIn: uploadLifetimeSeconds,
    headers: Object.freeze(headers),
  });
}

export async function inspectPrivateObject(input: {
  objectKey: string;
  fileId: string;
  expectedByteSize: number;
  expectedSha256: string | null;
}): Promise<VerifiedObject | null> {
  const object = await getR2Client().send(
    new HeadObjectCommand({
      Bucket: getPrivateBucketName(),
      Key: input.objectKey,
      ChecksumMode: ChecksumMode.ENABLED,
    }),
  );

  return verifyPrivateObjectHead(input, object);
}

export async function deletePrivateObject(objectKey: string): Promise<void> {
  await getR2Client().send(new DeleteObjectCommand({
    Bucket: getPrivateBucketName(),
    Key: objectKey,
  }));
}

export async function createPresignedDownload(input: {
  objectKey: string;
  filename: string;
  contentType: string;
}): Promise<{ url: string; expiresIn: number }> {
  const forceOpaqueDownload = input.contentType === "image/svg+xml";
  const command = new GetObjectCommand({
    Bucket: getPrivateBucketName(),
    Key: input.objectKey,
    ResponseContentDisposition: attachmentContentDisposition(input.filename),
    ResponseContentType: forceOpaqueDownload
      ? "application/octet-stream"
      : input.contentType,
    ResponseCacheControl: "private, no-store, max-age=0",
  });

  return {
    url: await getSignedUrl(getR2Client(), command, {
      expiresIn: downloadLifetimeSeconds,
    }),
    expiresIn: downloadLifetimeSeconds,
  };
}
