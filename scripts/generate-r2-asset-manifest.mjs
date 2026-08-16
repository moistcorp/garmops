import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import sharp from "sharp";

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const garmentRoot = resolve(requiredEnvironment("GARMENT_ASSET_SOURCE_DIR"));
const flatlayRoot = resolve(requiredEnvironment("FLATLAY_ASSET_SOURCE_DIR"));
const assetVersion = requiredEnvironment("ASSET_VERSION");
const assetOrigin = new URL(requiredEnvironment("ASSET_ORIGIN")).origin;
const bucket = requiredEnvironment("R2_BUCKET_NAME");
const outputPath = resolve(requiredEnvironment("ASSET_MANIFEST_OUTPUT"));
const cacheControl = "public, max-age=31536000, immutable";
const contentTypes = {
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

async function assertDirectory(path, variableName) {
  try {
    if ((await stat(path)).isDirectory()) return;
  } catch {
    // The actionable error below covers missing and unreadable paths.
  }
  throw new Error(`${variableName} is not a readable directory: ${path}`);
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    }),
  );
  return nested.flat();
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

async function inventory(collection, root) {
  const paths = (await walk(root))
    .filter((path) => contentTypes[extname(path).toLowerCase()])
    .sort();
  const objects = [];

  for (const path of paths) {
    const bytes = await readFile(path);
    const relativePath = relative(root, path);
    const extension = extname(path).toLowerCase();
    const metadata = await sharp(bytes).metadata();
    const object = {
      key: `${collection}/${assetVersion}/${relativePath}`,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      contentType: contentTypes[extension],
      width: metadata.width,
      height: metadata.height,
    };

    if (
      collection === "garments" &&
      /(mask\.png|(texture|shadow|highlight)\.(webp|png))$/u.test(relativePath)
    ) {
      const signalKind = relativePath.endsWith("mask.png") ? "mask" : "detail";
      const decoded = await sharp(bytes)
        .toColourspace("srgb")
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const signal = rendererSignal(
        decoded.data,
        decoded.info.width * decoded.info.height,
        signalKind,
      );
      object.signalKind = signalKind;
      object.signalSha256 = createHash("sha256").update(signal).digest("hex");
    }
    objects.push(object);
  }
  return objects;
}

await assertDirectory(garmentRoot, "GARMENT_ASSET_SOURCE_DIR");
await assertDirectory(flatlayRoot, "FLATLAY_ASSET_SOURCE_DIR");
const objects = [
  ...(await inventory("garments", garmentRoot)),
  ...(await inventory("flatlays", flatlayRoot)),
].sort((left, right) => left.key.localeCompare(right.key));
const garmentObjects = objects.filter((object) => object.key.startsWith("garments/"));
const flatlayObjects = objects.filter((object) => object.key.startsWith("flatlays/"));
const manifest = {
  schemaVersion: 1,
  assetVersion,
  assetOrigin,
  bucket,
  cacheControl,
  objects,
  summary: {
    garmentFiles: garmentObjects.length,
    flatlayFiles: flatlayObjects.length,
    totalFiles: objects.length,
    garmentBytes: garmentObjects.reduce((total, object) => total + object.bytes, 0),
    flatlayBytes: flatlayObjects.reduce((total, object) => total + object.bytes, 0),
    totalBytes: objects.reduce((total, object) => total + object.bytes, 0),
  },
};

await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${objects.length} objects to ${outputPath}`);
