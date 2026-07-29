import {
  ChecksumMode,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { loadEnvConfig } from "@next/env";
import { createHash, randomUUID } from "node:crypto";

loadEnvConfig(process.cwd());

const privateBucket = "garmops-private-orders";
const developmentOrigin = "http://localhost:3000";
const testBody = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+5qFNJwAAAABJRU5ErkJggg==",
  "base64",
);
const sha256Hex = createHash("sha256").update(testBody).digest("hex");
const sha256Base64 = Buffer.from(sha256Hex, "hex").toString("base64");
const fileId = randomUUID();
const objectKey = `phase5-verification/${fileId}/original.png`;

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const accountId = requireEnvironment("R2_ACCOUNT_ID");
  const accessKeyId = requireEnvironment("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnvironment("R2_SECRET_ACCESS_KEY");
  const endpoint = requireEnvironment("R2_S3_ENDPOINT");
  const configuredBucket = requireEnvironment("R2_PRIVATE_BUCKET");
  assert(configuredBucket === privateBucket, "Private bucket name is invalid");
  assert(
    endpoint === `https://${accountId}.r2.cloudflarestorage.com`,
    "R2 endpoint does not match the account ID",
  );

  const client = new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  let created = false;

  try {
    const put = new PutObjectCommand({
      Bucket: privateBucket,
      Key: objectKey,
      ContentType: "image/png",
      ChecksumSHA256: sha256Base64,
      Metadata: {
        "file-id": fileId,
        "expected-size": String(testBody.byteLength),
        "expected-sha256": sha256Hex,
      },
    });
    const uploadUrl = await getSignedUrl(client, put, {
      expiresIn: 420,
      unhoistableHeaders: new Set([
        "x-amz-checksum-sha256",
        "x-amz-meta-file-id",
        "x-amz-meta-expected-size",
        "x-amz-meta-expected-sha256",
      ]),
    });
    assert(
      new URL(uploadUrl).searchParams.get("X-Amz-Expires") === "420",
      "Upload URL expiry is not seven minutes",
    );

    const upload = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        origin: developmentOrigin,
        "content-type": "image/png",
        "x-amz-checksum-sha256": sha256Base64,
        "x-amz-meta-file-id": fileId,
        "x-amz-meta-expected-size": String(testBody.byteLength),
        "x-amz-meta-expected-sha256": sha256Hex,
      },
      body: testBody,
    });
    assert(upload.ok, `Presigned PUT failed with status ${upload.status}`);
    created = true;
    assert(
      upload.headers.get("access-control-allow-origin") === developmentOrigin,
      "Development CORS origin was not returned",
    );

    const head = await client.send(
      new HeadObjectCommand({
        Bucket: privateBucket,
        Key: objectKey,
        ChecksumMode: ChecksumMode.ENABLED,
      }),
    );
    assert(
      head.ContentLength === testBody.byteLength,
      "Stored byte size does not match",
    );
    assert(head.ContentType === "image/png", "Stored content type does not match");
    assert(head.Metadata?.["file-id"] === fileId, "Signed file metadata is missing");
    assert(
      head.Metadata?.["expected-size"] === String(testBody.byteLength),
      "Signed size metadata is missing",
    );
    assert(
      head.Metadata?.["expected-sha256"] === sha256Hex,
      "Signed checksum metadata is missing",
    );
    assert(
      head.ChecksumSHA256 === sha256Base64,
      "Stored SHA-256 checksum does not match",
    );

    const get = new GetObjectCommand({
      Bucket: privateBucket,
      Key: objectKey,
      ResponseContentDisposition:
        'attachment; filename="phase5-verification.png"',
      ResponseContentType: "image/png",
      ResponseCacheControl: "private, no-store, max-age=0",
    });
    const downloadUrl = await getSignedUrl(client, get, { expiresIn: 180 });
    assert(
      new URL(downloadUrl).searchParams.get("X-Amz-Expires") === "180",
      "Download URL expiry is not three minutes",
    );
    const download = await fetch(downloadUrl);
    assert(download.ok, `Presigned GET failed with status ${download.status}`);
    assert(
      download.headers.get("content-disposition") ===
        'attachment; filename="phase5-verification.png"',
      "Download is not forced to attachment",
    );
    assert(
      download.headers.get("cache-control") === "private, no-store, max-age=0",
      "Download cache policy is not private/no-store",
    );
    const downloadedBody = Buffer.from(await download.arrayBuffer());
    assert(
      createHash("sha256").update(downloadedBody).digest("hex") === sha256Hex,
      "Downloaded object checksum does not match",
    );

    process.stdout.write(
      [
        "private credential scope: passed",
        "presigned PUT and Development CORS: passed",
        "HEAD metadata, byte size, type, ETag/checksum: passed",
        "three-minute attachment GET and body hash: passed",
      ].join("\n") + "\n",
    );
  } finally {
    if (created) {
      assert(
        objectKey.startsWith("phase5-verification/"),
        "Refusing to delete an unexpected object key",
      );
      await client.send(
        new DeleteObjectCommand({
          Bucket: privateBucket,
          Key: objectKey,
        }),
      );
      process.stdout.write("temporary private object cleanup: passed\n");
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown failure";
  process.stderr.write(`Private R2 verification failed: ${message}\n`);
  process.exitCode = 1;
});
