import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const manifest = JSON.parse(
  await readFile(new URL("./garment-assets-r2-manifest.json", import.meta.url), "utf8"),
);
const expectedCacheControl = "public, max-age=31536000, immutable";

async function assertLegacyAssetsAreAbsent(path) {
  try {
    const entries = await readdir(path);
    if (entries.length > 0) {
      throw new Error(
        `${path} must remain absent; use an ignored external staging directory for future asset work.`,
      );
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await assertLegacyAssetsAreAbsent(join(process.cwd(), "public", "garments"));
await assertLegacyAssetsAreAbsent(join(process.cwd(), "public", "flatlays"));

function configuredOrigin() {
  const value = process.env.NEXT_PUBLIC_ASSET_CDN_URL?.trim() || manifest.assetOrigin;
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Unsupported asset origin protocol: ${url.protocol}`);
  }
  return url.origin;
}

function rendererSignal(raw, pixels, kind) {
  const output = Buffer.alloc(pixels);
  for (let index = 0; index < pixels; index += 1) {
    const offset = index * 4;
    output[index] = kind === "mask"
      ? raw[offset + 3]
      : Math.round(
          raw[offset] * 0.2126 +
          raw[offset + 1] * 0.7152 +
          raw[offset + 2] * 0.0722,
        );
  }
  return output;
}

const origin = configuredOrigin();
const failures = [];
let cursor = 0;
let verified = 0;
let verifiedBytes = 0;

async function verifyObject(object) {
  const response = await fetch(`${origin}/${object.key}`, {
    headers: { Origin: "https://www.garmops.com" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (response.headers.get("content-type") !== object.contentType) {
    throw new Error(`unexpected Content-Type ${response.headers.get("content-type")}`);
  }
  if (response.headers.get("cache-control") !== expectedCacheControl) {
    throw new Error(`unexpected Cache-Control ${response.headers.get("cache-control")}`);
  }
  if (response.headers.get("access-control-allow-origin") !== "*") {
    throw new Error(
      `unexpected Access-Control-Allow-Origin ${response.headers.get("access-control-allow-origin")}`,
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== object.bytes) {
    throw new Error(`byte size ${bytes.length} does not match ${object.bytes}`);
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== object.sha256) throw new Error("SHA-256 mismatch");

  const metadata = await sharp(bytes).metadata();
  if (metadata.width !== object.width || metadata.height !== object.height) {
    throw new Error(
      `dimensions ${metadata.width}x${metadata.height} do not match ${object.width}x${object.height}`,
    );
  }

  if (object.signalSha256) {
    const { data, info } = await sharp(bytes)
      .toColourspace("srgb")
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const signal = rendererSignal(data, info.width * info.height, object.signalKind);
    const signalSha256 = createHash("sha256").update(signal).digest("hex");
    if (signalSha256 !== object.signalSha256) {
      throw new Error("renderer signal mismatch");
    }
  }

  verified += 1;
  verifiedBytes += bytes.length;
}

async function worker() {
  while (true) {
    const index = cursor;
    cursor += 1;
    if (index >= manifest.objects.length) return;
    const object = manifest.objects[index];
    try {
      await verifyObject(object);
    } catch (error) {
      failures.push(`${object.key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

await Promise.all(Array.from({ length: 6 }, () => worker()));

const headTarget = manifest.objects[0];
const headResponse = await fetch(`${origin}/${headTarget.key}`, {
  method: "HEAD",
  headers: { Origin: "http://127.0.0.1:3100" },
});
if (!headResponse.ok || headResponse.headers.get("access-control-allow-origin") !== "*") {
  failures.push(`${headTarget.key}: anonymous cross-origin HEAD failed`);
}

if (failures.length > 0) {
  throw new Error(`Remote asset verification failed:\n${failures.join("\n")}`);
}
if (verified !== manifest.summary.totalFiles || verifiedBytes !== manifest.summary.totalBytes) {
  throw new Error(
    `Manifest summary mismatch: verified ${verified} files / ${verifiedBytes} bytes`,
  );
}

console.log(
  `Verified ${verified} remote assets (${verifiedBytes} bytes): paths, bytes, SHA-256, dimensions, renderer signals, MIME, immutable caching, GET/HEAD CORS.`,
);
