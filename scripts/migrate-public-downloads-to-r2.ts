import {
  ChecksumMode,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { loadEnvConfig } from "@next/env";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

loadEnvConfig(process.cwd());

const publicBucket = "garmops-public-downloads";
const cacheControl = "public, max-age=31536000, immutable";
const contentType = "application/zip";
const apply = process.argv.includes("--apply");
const downloads = [
  {
    source: "public/downloads/Garmops-print_templates-1.0.zip",
    objectKey: "templates/print/Garmops-print_templates-1.0.zip",
  },
  {
    source: "public/downloads/neck-label-templates.zip",
    objectKey: "templates/neck-label/neck-label-templates-1.0.zip",
  },
] as const;

type ObjectSummary = Readonly<{
  source: string;
  objectKey: string;
  byteSize: number;
  sha256: string;
  publicUrl: string;
}>;

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required with --apply`);
  return value;
}

function downloadsOrigin(): string {
  const url = new URL(
    process.env.NEXT_PUBLIC_DOWNLOADS_BASE_URL ??
      "https://downloads.garmops.com",
  );
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "NEXT_PUBLIC_DOWNLOADS_BASE_URL must be an HTTPS origin",
    );
  }
  return url.origin;
}

function isMissingObject(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.name === "NotFound" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

async function summarize(): Promise<
  Array<ObjectSummary & { body: Uint8Array }>
> {
  const publicOrigin = downloadsOrigin();
  return Promise.all(
    downloads.map(async ({ source, objectKey }) => {
      const body = await readFile(path.resolve(process.cwd(), source));
      const sha256 = createHash("sha256").update(body).digest("hex");

      return {
        source,
        objectKey,
        body,
        byteSize: body.byteLength,
        sha256,
        publicUrl: `${publicOrigin}/${objectKey}`,
      };
    }),
  );
}

async function headObject(client: S3Client, objectKey: string) {
  try {
    return await client.send(
      new HeadObjectCommand({
        Bucket: publicBucket,
        Key: objectKey,
        ChecksumMode: ChecksumMode.ENABLED,
      }),
    );
  } catch (error) {
    if (isMissingObject(error)) return null;
    throw error;
  }
}

async function remoteObjectSha256(
  client: S3Client,
  objectKey: string,
): Promise<string> {
  const object = await client.send(
    new GetObjectCommand({
      Bucket: publicBucket,
      Key: objectKey,
    }),
  );
  if (!object.Body) {
    throw new Error(`Existing object body is unavailable: ${objectKey}`);
  }
  const body = await object.Body.transformToByteArray();
  return createHash("sha256").update(body).digest("hex");
}

async function main() {
  const objects = await summarize();
  const printable = objects.map((object) => ({
    source: object.source,
    objectKey: object.objectKey,
    byteSize: object.byteSize,
    sha256: object.sha256,
    publicUrl: object.publicUrl,
  }));

  if (!apply) {
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: "dry-run",
          bucket: publicBucket,
          cacheControl,
          objects: printable,
          next: "Run this command again with --apply after R2 credentials are configured.",
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  const accountId = requireEnvironment("R2_ACCOUNT_ID");
  const accessKeyId = requireEnvironment("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnvironment("R2_SECRET_ACCESS_KEY");
  const endpoint = requireEnvironment("R2_S3_ENDPOINT");
  const configuredBucket = requireEnvironment("R2_PUBLIC_BUCKET");

  if (configuredBucket !== publicBucket) {
    throw new Error(`R2_PUBLIC_BUCKET must be ${publicBucket}`);
  }
  const endpointUrl = new URL(endpoint);
  if (
    endpointUrl.origin !==
      `https://${accountId}.r2.cloudflarestorage.com` ||
    endpointUrl.pathname !== "/" ||
    endpointUrl.search ||
    endpointUrl.hash ||
    endpointUrl.username ||
    endpointUrl.password
  ) {
    throw new Error("R2_S3_ENDPOINT does not match R2_ACCOUNT_ID");
  }

  const client = new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  for (const object of objects) {
    const existing = await headObject(client, object.objectKey);
    if (existing) {
      const metadataMatches =
        existing.ContentLength === object.byteSize &&
        existing.ContentType === contentType &&
        existing.CacheControl === cacheControl &&
        existing.Metadata?.sha256 === object.sha256;
      const matches =
        metadataMatches ||
        (existing.ContentLength === object.byteSize &&
          existing.ContentType === contentType &&
          existing.CacheControl === cacheControl &&
          (await remoteObjectSha256(client, object.objectKey)) ===
            object.sha256);
      if (!matches) {
        throw new Error(
          `Existing immutable object does not match: ${object.objectKey}`,
        );
      }
      process.stdout.write(`verified existing ${object.publicUrl}\n`);
      continue;
    }

    await client.send(
      new PutObjectCommand({
        Bucket: publicBucket,
        Key: object.objectKey,
        Body: object.body,
        ContentType: contentType,
        CacheControl: cacheControl,
        ChecksumSHA256: Buffer.from(object.sha256, "hex").toString("base64"),
        Metadata: {
          sha256: object.sha256,
          source: "garmops-repository-migration",
        },
      }),
    );

    const uploaded = await headObject(client, object.objectKey);
    if (
      !uploaded ||
      uploaded.ContentLength !== object.byteSize ||
      uploaded.ContentType !== contentType ||
      uploaded.CacheControl !== cacheControl ||
      uploaded.Metadata?.sha256 !== object.sha256
    ) {
      throw new Error(`R2 verification failed: ${object.objectKey}`);
    }
    process.stdout.write(`uploaded and verified ${object.publicUrl}\n`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown failure";
  process.stderr.write(`Public R2 migration failed: ${message}\n`);
  process.exitCode = 1;
});
