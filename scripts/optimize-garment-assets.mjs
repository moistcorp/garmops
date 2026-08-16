import { createHash } from "node:crypto";
import { readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import sharp from "sharp";

const sourceValue = process.env.GARMENT_ASSET_SOURCE_DIR?.trim();
if (!sourceValue) {
  throw new Error(
    "GARMENT_ASSET_SOURCE_DIR is required. Point it at a complete local garment staging directory outside Git; production R2 objects are never modified in place.",
  );
}

const root = resolve(sourceValue);
try {
  if (!(await stat(root)).isDirectory()) throw new Error("not a directory");
} catch {
  throw new Error(
    `GARMENT_ASSET_SOURCE_DIR does not exist or is not a directory: ${root}`,
  );
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

const files = (await walk(root))
  .filter((path) => /(mask\.png|(texture|shadow|highlight)\.(webp|png))$/u.test(path))
  .sort();
if (files.length === 0) {
  throw new Error(`No renderer layer files were found under ${root}`);
}

const rows = [];
for (const path of files) {
  const before = (await stat(path)).size;
  const kind = path.endsWith("mask.png") ? "mask" : "detail";
  const image = sharp(path).toColourspace("srgb").ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const signal = rendererSignal(data, info.width * info.height, kind);
  const rgba = Buffer.alloc(info.width * info.height * 4);

  for (let index = 0; index < signal.length; index += 1) {
    const offset = index * 4;
    if (kind === "mask") {
      rgba[offset] = 255;
      rgba[offset + 1] = 255;
      rgba[offset + 2] = 255;
      rgba[offset + 3] = signal[index];
    } else {
      rgba[offset] = signal[index];
      rgba[offset + 1] = signal[index];
      rgba[offset + 2] = signal[index];
      rgba[offset + 3] = data[offset + 3];
    }
  }

  const encoder = sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  });
  const candidate = path.endsWith(".png")
    ? await encoder.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer()
    : await encoder.webp({ lossless: true, effort: 6 }).toBuffer();
  const decoded = await sharp(candidate)
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const candidateSignal = rendererSignal(
    decoded.data,
    decoded.info.width * decoded.info.height,
    kind,
  );
  const equivalent =
    decoded.info.width === info.width &&
    decoded.info.height === info.height &&
    candidateSignal.equals(signal);
  const changed = equivalent && candidate.length < before;
  if (changed) await writeFile(path, candidate);

  rows.push({
    path: relative(root, path),
    before,
    after: changed ? candidate.length : before,
    changed,
    signalSha256: createHash("sha256").update(signal).digest("hex"),
  });
}

const totalBefore = rows.reduce((total, row) => total + row.before, 0);
const totalAfter = rows.reduce((total, row) => total + row.after, 0);
console.log(JSON.stringify({
  sourceDirectory: root,
  files: rows.length,
  optimized: rows.filter((row) => row.changed).length,
  totalBefore,
  totalAfter,
  reductionPercent: Number((((totalBefore - totalAfter) / totalBefore) * 100).toFixed(2)),
}, null, 2));
