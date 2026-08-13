import { ArtworkProcessingError, type RasterArtworkAnalysis } from "./types";

export const MAX_DECODED_RASTER_PIXELS = 40_000_000;
export const MAX_PREVIEW_DIMENSION = 2400;
const ANALYSIS_DIMENSION = 256;

type Rgba = [number, number, number];

function distance(a: Rgba, b: Rgba): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function hex(rgb: Rgba): string {
  return `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function pixel(data: Uint8ClampedArray, index: number): Rgba {
  return [data[index], data[index + 1], data[index + 2]];
}

function quantizedColorCount(data: Uint8ClampedArray): number {
  const colors = new Set<string>();
  for (let index = 0; index < data.length; index += 16) {
    if (data[index + 3] < 16) continue;
    colors.add(`${data[index] >> 4},${data[index + 1] >> 4},${data[index + 2] >> 4}`);
  }
  return colors.size;
}

function detectBackground(data: Uint8ClampedArray, width: number, height: number): RasterArtworkAnalysis["background"] {
  const samples: Rgba[] = [];
  const step = Math.max(1, Math.floor(Math.max(width, height) / 64));
  for (let x = 0; x < width; x += step) {
    for (const y of [0, height - 1]) {
      const index = (y * width + x) * 4;
      if (data[index + 3] > 235) samples.push(pixel(data, index));
    }
  }
  for (let y = 0; y < height; y += step) {
    for (const x of [0, width - 1]) {
      const index = (y * width + x) * 4;
      if (data[index + 3] > 235) samples.push(pixel(data, index));
    }
  }
  if (samples.length < 12) return undefined;
  const average: Rgba = [
    samples.reduce((sum, value) => sum + value[0], 0) / samples.length,
    samples.reduce((sum, value) => sum + value[1], 0) / samples.length,
    samples.reduce((sum, value) => sum + value[2], 0) / samples.length,
  ];
  const maxDistance = Math.max(...samples.map((sample) => distance(sample, average)));
  if (maxDistance > 18) return undefined;
  const confidence = Math.max(0, Math.min(1, 0.995 - maxDistance / 220));
  return { color: hex(average), confidence };
}

function contentBounds(data: Uint8ClampedArray, width: number, height: number): RasterArtworkAnalysis["contentBounds"] {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 16) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? undefined : { left, top, right: right + 1, bottom: bottom + 1 };
}

export function analyseRasterPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  naturalWidth: number,
  naturalHeight: number,
): RasterArtworkAnalysis {
  let transparent = false;
  let luminanceTotal = 0;
  let samples = 0;
  let localVariation = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      if (alpha < 250) transparent = true;
      if (alpha > 25) {
        luminanceTotal += (0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255;
        samples += 1;
      }
      if (x > 0 && alpha > 25) localVariation += distance(pixel(data, index), pixel(data, index - 4));
    }
  }
  const detectedColorCount = quantizedColorCount(data);
  const averageVariation = localVariation / Math.max(1, width * height);
  const isContinuousTone = detectedColorCount > 96 || averageVariation > 22;
  const isFlatGraphicCandidate = !isContinuousTone && detectedColorCount <= 48;
  return {
    pixelWidth: naturalWidth,
    pixelHeight: naturalHeight,
    hasTransparency: transparent,
    averageLuminance: samples ? luminanceTotal / samples : undefined,
    detectedColorCount,
    isContinuousTone,
    isFlatGraphicCandidate,
    background: transparent ? undefined : detectBackground(data, width, height),
    contentBounds: contentBounds(data, width, height),
  };
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ArtworkProcessingError("decode_failed", "Raster image could not be decoded"));
    };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new ArtworkProcessingError("preview_generation_failed")), "image/png");
  });
}

function removeUniformBackground(data: Uint8ClampedArray, width: number, height: number, background: Rgba): boolean {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const enqueue = (x: number, y: number) => {
    const position = y * width + x;
    if (visited[position]) return;
    const index = position * 4;
    if (data[index + 3] < 20 || distance(pixel(data, index), background) > 32) return;
    visited[position] = 1;
    queue[tail++] = position;
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }
  while (head < tail) {
    const position = queue[head++];
    const x = position % width;
    const y = Math.floor(position / width);
    data[position * 4 + 3] = 0;
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < height) enqueue(x, y + 1);
  }
  return tail > 0;
}

function cropTransparentPadding(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return canvas;
  const output = context.getImageData(0, 0, canvas.width, canvas.height);
  const bounds = contentBounds(output.data, canvas.width, canvas.height);
  if (!bounds) return canvas;
  const padding = Math.max(2, Math.ceil(Math.max(canvas.width, canvas.height) * 0.01));
  const left = Math.max(0, bounds.left - padding);
  const top = Math.max(0, bounds.top - padding);
  const right = Math.min(canvas.width, bounds.right + padding);
  const bottom = Math.min(canvas.height, bounds.bottom + padding);
  if (left === 0 && top === 0 && right === canvas.width && bottom === canvas.height) return canvas;
  const cropped = document.createElement("canvas");
  cropped.width = right - left;
  cropped.height = bottom - top;
  cropped.getContext("2d")?.drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
  return cropped;
}

export async function normalizeRaster(blob: Blob): Promise<{ blob: Blob; analysis: RasterArtworkAnalysis; backgroundRemoved: boolean }> {
  const image = await loadImage(blob);
  if (!image.naturalWidth || !image.naturalHeight) throw new ArtworkProcessingError("decode_failed");
  if (image.naturalWidth * image.naturalHeight > MAX_DECODED_RASTER_PIXELS) {
    throw new ArtworkProcessingError("processing_limit", "Raster dimensions exceed the safe processing limit");
  }
  const analysisScale = Math.min(1, ANALYSIS_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const analysisCanvas = document.createElement("canvas");
  analysisCanvas.width = Math.max(1, Math.round(image.naturalWidth * analysisScale));
  analysisCanvas.height = Math.max(1, Math.round(image.naturalHeight * analysisScale));
  const analysisContext = analysisCanvas.getContext("2d", { willReadFrequently: true });
  if (!analysisContext) throw new ArtworkProcessingError("preview_generation_failed");
  analysisContext.drawImage(image, 0, 0, analysisCanvas.width, analysisCanvas.height);
  const analysis = analyseRasterPixels(
    analysisContext.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height).data,
    analysisCanvas.width,
    analysisCanvas.height,
    image.naturalWidth,
    image.naturalHeight,
  );

  const scale = Math.min(1, MAX_PREVIEW_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new ArtworkProcessingError("preview_generation_failed");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  let backgroundRemoved = false;
  if (analysis.background && analysis.background.confidence >= 0.97) {
    const output = context.getImageData(0, 0, canvas.width, canvas.height);
    const rgb = analysis.background.color.slice(1).match(/.{2}/g)?.map((value) => Number.parseInt(value, 16)) ?? [255, 255, 255];
    backgroundRemoved = removeUniformBackground(output.data, canvas.width, canvas.height, rgb as Rgba);
    if (backgroundRemoved) context.putImageData(output, 0, 0);
  }
  const outputCanvas = analysis.hasTransparency || backgroundRemoved
    ? cropTransparentPadding(canvas)
    : canvas;
  return { blob: await canvasBlob(outputCanvas), analysis, backgroundRemoved };
}
