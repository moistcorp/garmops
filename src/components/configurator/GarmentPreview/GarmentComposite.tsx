"use client";

import { useEffect, useEffectEvent, useMemo, useRef } from "react";
import type { GarmentRenderProfile } from "./garmentAssets";

const MAX_STANDARD_RENDER_DIMENSION = 1400;
const MAX_PHOTOGRAPHIC_RENDER_DIMENSION = 3000;
const MIN_STANDARD_RENDER_DIMENSION = 720;
const MIN_PHOTOGRAPHIC_RENDER_DIMENSION = 1800;
const MAX_CACHED_VIEWS = 2;
const WATERCOLOUR_TRANSITION_DURATION_MS = 520;
const WATERCOLOUR_BLOOM_POINTS = 64;

interface GarmentCompositeProps {
  maskSrc: string;
  textureSrc: string;
  shadowSrc: string;
  highlightSrc: string;
  colourHex: string;
  renderProfile: GarmentRenderProfile;
  cacheScope: string;
  exclusiveCacheScope?: boolean;
  className?: string;
  onRenderProgress?: (progress: GarmentCompositeRenderProgress) => void;
}

export type GarmentCompositeRenderState =
  | "loading"
  | "compositing"
  | "ready"
  | "error";

export interface GarmentCompositeRenderProgress {
  state: GarmentCompositeRenderState;
  loadedLayers: number;
  totalLayers: number;
}

interface LayerPixels {
  width: number;
  height: number;
  /**
   * One byte per source layer, packed into RGBA-shaped slots:
   * mask alpha, texture luminance, shadow luminance, highlight luminance.
   */
  signals: Uint8Array;
  /** Median luminance of the photographic detail layer inside the garment mask. */
  detailReference: number;
}

interface LayerCacheEntry {
  scope: string;
  promise: Promise<LayerPixels>;
  loadedLayers: number;
  progressListeners: Set<(loadedLayers: number, totalLayers: number) => void>;
}

const layerCache = new Map<string, LayerCacheEntry>();
const GARMENT_LAYER_COUNT = 4;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const progress = clamp((value - edge0) / (edge1 - edge0));
  return progress * progress * (3 - 2 * progress);
}

function easeInOutCubic(progress: number): number {
  return progress < 0.5
    ? 4 * Math.pow(progress, 3)
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

interface WatercolourBloom {
  x: number;
  y: number;
  delay: number;
  scale: number;
  seed: number;
}

const WATERCOLOUR_BLOOMS: readonly WatercolourBloom[] = [
  { x: 0.39, y: 0.38, delay: 0, scale: 0.64, seed: 1.7 },
  { x: 0.61, y: 0.43, delay: 0.06, scale: 0.66, seed: 4.2 },
  { x: 0.49, y: 0.64, delay: 0.12, scale: 0.72, seed: 7.9 },
];

/**
 * Adds a slightly uneven bloom to the current path. Several of these paths
 * overlap to make the colour feel absorbed by fabric rather than revealed by
 * one mechanically perfect circle.
 */
function traceWatercolourBloom(
  context: CanvasRenderingContext2D,
  bloom: WatercolourBloom,
  width: number,
  height: number,
  progress: number,
  expansion: number,
): void {
  const localProgress = clamp((progress - bloom.delay) / (1 - bloom.delay));
  if (localProgress <= 0) return;

  const originX = bloom.x * width;
  const originY = bloom.y * height;
  const bloomRadius = Math.max(width, height) * localProgress * bloom.scale * expansion;

  for (let point = 0; point < WATERCOLOUR_BLOOM_POINTS; point += 1) {
    const angle = (point / WATERCOLOUR_BLOOM_POINTS) * Math.PI * 2;
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);
    const ripple =
      1 +
      Math.sin(angle * 5 + bloom.seed) * 0.085 +
      Math.sin(angle * 11 - bloom.seed * 1.8) * 0.038 +
      Math.sin(angle * 17 + bloom.seed * 0.7) * 0.018;
    const radius = bloomRadius * ripple;
    const x = originX + directionX * radius;
    const y = originY + directionY * radius;

    if (point === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }

  context.closePath();
}

function drawWatercolourPass(
  context: CanvasRenderingContext2D,
  incomingCanvas: HTMLCanvasElement,
  progress: number,
  expansion: number,
  opacity: number,
): void {
  WATERCOLOUR_BLOOMS.forEach((bloom) => {
    context.save();
    context.beginPath();
    traceWatercolourBloom(
      context,
      bloom,
      incomingCanvas.width,
      incomingCanvas.height,
      progress,
      expansion,
    );
    context.clip();
    context.globalAlpha = opacity;
    context.drawImage(incomingCanvas, 0, 0);
    context.restore();
  });
}

function paintWatercolourReveal(
  context: CanvasRenderingContext2D,
  incomingCanvas: HTMLCanvasElement,
  progress: number,
): void {
  const easedProgress = easeInOutCubic(clamp(progress));

  // Wide translucent washes lead the denser pigment. Drawing each bloom
  // separately lets their overlaps deepen like layered watercolour on paper.
  drawWatercolourPass(context, incomingCanvas, easedProgress, 1.18, 0.1);
  drawWatercolourPass(context, incomingCanvas, easedProgress, 1, 0.24);
  drawWatercolourPass(context, incomingCanvas, easedProgress, 0.82, 0.58);
  drawWatercolourPass(context, incomingCanvas, easedProgress, 0.65, 0.92);
}

function parseHex(hex: string): [number, number, number] {
  const normalized = hex.trim().replace(/^#/, "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => character + character)
          .join("")
      : normalized;

  if (!/^[0-9a-f]{6}$/i.test(full)) return [128, 128, 128];

  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

function rgbToHsl(red: number, green: number, blue: number): [number, number, number] {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;

  if (max === min) return [0, 0, lightness];

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue: number;
  if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  return [hue / 6, saturation, lightness];
}

function hueToRgb(p: number, q: number, hue: number): number {
  let t = hue;
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  if (saturation === 0) {
    const value = Math.round(lightness * 255);
    return [value, value, value];
  }

  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;

  return [
    Math.round(hueToRgb(p, q, hue + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, hue) * 255),
    Math.round(hueToRgb(p, q, hue - 1 / 3) * 255),
  ];
}

/**
 * Fabric previews need a narrower tonal range than literal screen colours.
 * Near-black colours are lifted so folds and stitching remain visible, while
 * near-white colours are pulled slightly below the preview background.
 * The selected colour itself is unchanged everywhere else in the configurator.
 */
export function getDisplayPreviewColour(hex: string): [number, number, number] {
  const [red, green, blue] = parseHex(hex);
  const [hue, saturation, lightness] = rgbToHsl(red, green, blue);

  let displayLightness = lightness;
  if (lightness < 0.22) {
    displayLightness = 0.105 + (lightness / 0.22) * 0.115;
  } else if (lightness > 0.78) {
    displayLightness = 0.9 + ((lightness - 0.78) / 0.22) * 0.08;
  }

  return hslToRgb(hue, saturation * 0.95, clamp(displayLightness));
}

export function getDisplayPreviewHex(hex: string): string {
  return `#${getDisplayPreviewColour(hex)
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load garment preview asset: ${src}`));
    image.src = src;
  });
}

function buildLayerSignals(
  images: readonly [
    mask: HTMLImageElement,
    texture: HTMLImageElement,
    shadow: HTMLImageElement,
    highlight: HTMLImageElement,
  ],
  width: number,
  height: number
): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D rendering is unavailable.");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const signals = new Uint8Array(width * height * 4);

  images.forEach((image, channel) => {
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const source = context.getImageData(0, 0, width, height).data;

    for (let offset = 0; offset < source.length; offset += 4) {
      signals[offset + channel] =
        channel === 0
          ? source[offset + 3]
          : Math.round(
              source[offset] * 0.2126 +
                source[offset + 1] * 0.7152 +
                source[offset + 2] * 0.0722
            );
    }
  });

  return signals;
}

function touchCacheEntry(cacheKey: string, entry: LayerCacheEntry): void {
  layerCache.delete(cacheKey);
  layerCache.set(cacheKey, entry);
}

function trimLayerCache(): void {
  while (layerCache.size > MAX_CACHED_VIEWS) {
    const oldestKey = layerCache.keys().next().value;
    if (oldestKey === undefined) return;
    layerCache.delete(oldestKey);
  }
}

function getRenderDimension(
  canvas: HTMLCanvasElement,
  renderProfile: GarmentRenderProfile
): number {
  const cssDimension = Math.max(canvas.clientWidth, canvas.clientHeight);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const maxDimension =
    renderProfile === "photographic"
      ? MAX_PHOTOGRAPHIC_RENDER_DIMENSION
      : MAX_STANDARD_RENDER_DIMENSION;
  const minDimension =
    renderProfile === "photographic"
      ? MIN_PHOTOGRAPHIC_RENDER_DIMENSION
      : MIN_STANDARD_RENDER_DIMENSION;

  return Math.min(
    maxDimension,
    Math.max(minDimension, Math.ceil(cssDimension * pixelRatio))
  );
}

function getDetailReference(signals: Uint8Array): number {
  const histogram = new Uint32Array(256);
  let count = 0;

  for (let offset = 0; offset < signals.length; offset += 4) {
    if (signals[offset] < 16) continue;
    histogram[signals[offset + 3]] += 1;
    count += 1;
  }

  if (count === 0) return 26;

  const midpoint = Math.ceil(count / 2);
  let cumulative = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    cumulative += histogram[value];
    if (cumulative >= midpoint) return value;
  }

  return 26;
}

function loadLayers(
  cacheScope: string,
  exclusiveCacheScope: boolean,
  renderDimension: number,
  maskSrc: string,
  textureSrc: string,
  shadowSrc: string,
  highlightSrc: string,
  onProgress?: (loadedLayers: number, totalLayers: number) => void,
): Promise<LayerPixels> {
  if (exclusiveCacheScope) {
    for (const [cacheKey, entry] of layerCache) {
      if (entry.scope !== cacheScope) layerCache.delete(cacheKey);
    }
  }

  const cacheKey = [
    cacheScope,
    renderDimension,
    maskSrc,
    textureSrc,
    shadowSrc,
    highlightSrc,
  ].join("|");
  const cached = layerCache.get(cacheKey);
  if (cached) {
    touchCacheEntry(cacheKey, cached);
    if (onProgress) {
      cached.progressListeners.add(onProgress);
      onProgress(cached.loadedLayers, GARMENT_LAYER_COUNT);
    }
    return cached.promise;
  }

  const layerProgress = { loadedLayers: 0 };
  const progressListeners = new Set(onProgress ? [onProgress] : []);
  const trackedImage = (src: string) => loadImage(src).then((image) => {
    layerProgress.loadedLayers += 1;
    progressListeners.forEach((listener) => {
      listener(layerProgress.loadedLayers, GARMENT_LAYER_COUNT);
    });
    return image;
  });
  const promise = Promise.all([
    trackedImage(maskSrc),
    trackedImage(textureSrc),
    trackedImage(shadowSrc),
    trackedImage(highlightSrc),
  ]).then(([maskImage, textureImage, shadowImage, highlightImage]) => {
    const sourceWidth = maskImage.naturalWidth;
    const sourceHeight = maskImage.naturalHeight;
    const scale = Math.min(1, renderDimension / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const signals = buildLayerSignals(
      [maskImage, textureImage, shadowImage, highlightImage],
      width,
      height
    );

    return {
      width,
      height,
      signals,
      detailReference: getDetailReference(signals),
    };
  });

  const entry: LayerCacheEntry = {
    scope: cacheScope,
    promise,
    get loadedLayers() {
      return layerProgress.loadedLayers;
    },
    progressListeners,
  };
  touchCacheEntry(cacheKey, entry);
  trimLayerCache();
  promise.catch(() => {
    if (layerCache.get(cacheKey)?.promise === promise) {
      layerCache.delete(cacheKey);
    }
  });
  return promise;
}

function renderStandardComposite(
  context: CanvasRenderingContext2D,
  layers: LayerPixels,
  colourHex: string
): void {
  const { width, height, signals } = layers;
  const output = context.createImageData(width, height);
  const pixels = output.data;
  const [baseRed, baseGreen, baseBlue] = getDisplayPreviewColour(colourHex);
  const baseLuminance =
    (baseRed * 0.2126 + baseGreen * 0.7152 + baseBlue * 0.0722) / 255;

  const darkProfile = smoothstep(0.45, 0.1, baseLuminance);
  const lightProfile = smoothstep(0.65, 0.95, baseLuminance);

  const shadowStrength = 0.12 + 0.05 * lightProfile - 0.02 * darkProfile;
  const detailStrength = 0.1 + 0.03 * lightProfile - 0.015 * darkProfile;
  const highlightStrength = 0.02 + 0.07 * darkProfile - 0.01 * lightProfile;
  const darkColourLift = 0.012 * darkProfile;

  for (let offset = 0; offset < pixels.length; offset += 4) {
    const alpha = signals[offset] / 255;
    if (alpha <= 0) continue;

    const textureLuminance = signals[offset + 1];
    const shadowLuminance = signals[offset + 2];
    const highlightLuminance = signals[offset + 3];

    const shadowSignal = Math.pow(clamp((252 - shadowLuminance) / 85), 0.9);
    const detailSignal = Math.pow(clamp((248 - textureLuminance) / 90), 1.6);
    const highlightSignal = Math.pow(clamp((highlightLuminance - 3) / 35), 1.1);

    const darken =
      (1 - shadowSignal * shadowStrength) *
      (1 - detailSignal * detailStrength);
    const highlightAlpha = highlightSignal * highlightStrength;

    const renderChannel = (baseChannel: number): number => {
      const shadowed = baseChannel * darken;
      const lifted = shadowed * (1 - darkColourLift) + 255 * darkColourLift;
      return lifted * (1 - highlightAlpha) + 255 * highlightAlpha;
    };

    pixels[offset] = renderChannel(baseRed);
    pixels[offset + 1] = renderChannel(baseGreen);
    pixels[offset + 2] = renderChannel(baseBlue);
    pixels[offset + 3] = Math.round(alpha * 255);
  }

  context.putImageData(output, 0, 0);
}

function getPhotographicPreviewColour(hex: string): [number, number, number] {
  const [red, green, blue] = parseHex(hex);
  const [hue, saturation, lightness] = rgbToHsl(red, green, blue);

  let displayLightness = lightness;
  if (lightness < 0.22) {
    // The photographic garment sources were captured on a black garment. Keep
    // black dense, but give the photographed fibres enough luminance to remain visible.
    displayLightness = 0.1 + (lightness / 0.22) * 0.06;
  } else if (lightness > 0.78) {
    // Keep whites slightly below the preview background so the photographic
    // fibres and stitch shadows retain visible headroom instead of clipping.
    displayLightness = 0.885 + ((lightness - 0.78) / 0.22) * 0.06;
  }

  // Preserve the selected colour's chroma. The photographic compositor below
  // now changes luminance multiplicatively, so we no longer need to mute the
  // base colour to stop highlights from becoming over-saturated.
  return hslToRgb(hue, saturation, clamp(displayLightness));
}

function renderPhotographicComposite(
  context: CanvasRenderingContext2D,
  layers: LayerPixels,
  colourHex: string
): void {
  const { width, height, signals, detailReference } = layers;
  const output = context.createImageData(width, height);
  const pixels = output.data;
  const [baseRed, baseGreen, baseBlue] = getPhotographicPreviewColour(colourHex);
  const baseLuminance255 = Math.max(
    1,
    baseRed * 0.2126 + baseGreen * 0.7152 + baseBlue * 0.0722
  );
  const baseLuminance = baseLuminance255 / 255;

  const darkProfile = smoothstep(0.44, 0.08, baseLuminance);
  const lightProfile = smoothstep(0.67, 0.96, baseLuminance);
  const midProfile = clamp(1 - Math.abs(baseLuminance - 0.5) / 0.5);

  const shadowScale = 3 + 14 * (1 - darkProfile) + 18 * lightProfile;
  const textureScale = 1.5 + 5 * (1 - darkProfile) + 8 * lightProfile;

  /**
   * The supplied highlight.webp is actually a photographed black garment,
   * not a conventional highlight map. It contains several genuinely bright
   * seam/rim pixels around the neckline and shoulder joins. If those positive
   * values are transferred linearly to the selected colour they become the
   * grey/white outlines that were visible on very dark garments.
   *
   * Preserve the negative photographic information (knit valleys, folds,
   * stitches and AO) strongly, but compress positive values into a small
   * highlight range. This keeps the real fabric texture while preventing the
   * photographed white rim from being recoloured as a glowing outline.
   */
  const negativePhotoGain = 0.92 + 0.05 * (1 - lightProfile);
  const positiveCoreGain = 0.56 + 0.12 * midProfile;
  const maxHighlightLift = 10 + 5 * midProfile;

  const photoLookup = new Float32Array(256);
  const shadowLookup = new Float32Array(256);
  const textureLookup = new Float32Array(256);

  for (let value = 0; value < 256; value += 1) {
    const rawPhotoDelta = value - detailReference;

    if (rawPhotoDelta <= 0) {
      photoLookup[value] = rawPhotoDelta * negativePhotoGain;
    } else {
      // Keep small positive fibre variation, but heavily compress the bright
      // neckline/shoulder rim present in the photographic source.
      const core = Math.min(rawPhotoDelta, 10) * positiveCoreGain;
      const brightTail = Math.max(0, rawPhotoDelta - 10);
      const compressedTail = Math.tanh(brightTail / 24) * 4.5;
      photoLookup[value] = Math.min(core + compressedTail, maxHighlightLift);
    }

    shadowLookup[value] =
      Math.pow(clamp((244 - value) / 54), 1.15) * shadowScale;
    textureLookup[value] =
      Math.pow(clamp((252 - value) / 72), 1.35) * textureScale;
  }

  for (let offset = 0; offset < pixels.length; offset += 4) {
    const sourceAlpha = signals[offset] / 255;
    if (sourceAlpha <= 0) continue;

    const textureLuminance = signals[offset + 1];
    const shadowLuminance = signals[offset + 2];
    const photographicLuminance = signals[offset + 3];

    const photoDetail = photoLookup[photographicLuminance];
    const shadowAmount = shadowLookup[shadowLuminance];
    const textureAmount = textureLookup[textureLuminance];
    const tonalOffset = photoDetail - shadowAmount - textureAmount;

    // Multiplicative luminance shading preserves the selected hue/chroma.
    // The second ceiling is intentional: even if multiple maps happen to line
    // up on a bright source seam, the resulting garment can never jump far
    // above the selected fabric colour and create a white/grey outline.
    let targetLuminance = clamp(baseLuminance255 + tonalOffset, 3, 252);
    targetLuminance = Math.min(
      targetLuminance,
      baseLuminance255 + maxHighlightLift
    );

    const shade = targetLuminance / baseLuminance255;

    pixels[offset] = clamp(baseRed * shade, 0, 255);
    pixels[offset + 1] = clamp(baseGreen * shade, 0, 255);
    pixels[offset + 2] = clamp(baseBlue * shade, 0, 255);

    // Remove the tiny translucent fringe created when the high-resolution mask
    // is downsampled. Very low-alpha pixels are discarded and the remaining
    // antialias ramp is biased slightly more opaque so a white page cannot show
    // through as a pale garment silhouette.
    const outputAlpha =
      sourceAlpha < 0.06 ? 0 : Math.pow(sourceAlpha, 0.75);
    pixels[offset + 3] = Math.round(outputAlpha * 255);
  }

  context.putImageData(output, 0, 0);
}

function renderComposite(
  context: CanvasRenderingContext2D,
  layers: LayerPixels,
  colourHex: string,
  renderProfile: GarmentRenderProfile
): void {
  if (renderProfile === "photographic") {
    renderPhotographicComposite(context, layers, colourHex);
    return;
  }

  renderStandardComposite(context, layers, colourHex);
}

export default function GarmentComposite({
  maskSrc,
  textureSrc,
  shadowSrc,
  highlightSrc,
  colourHex,
  renderProfile,
  cacheScope,
  exclusiveCacheScope = false,
  className = "absolute inset-0 h-full w-full object-contain",
  onRenderProgress,
}: GarmentCompositeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const notifyRenderProgress = useEffectEvent((progress: GarmentCompositeRenderProgress) => {
    onRenderProgress?.(progress);
  });
  const assetKey = useMemo(
    () => [maskSrc, textureSrc, shadowSrc, highlightSrc].join("|"),
    [maskSrc, textureSrc, shadowSrc, highlightSrc]
  );

  useEffect(() => {
    let cancelled = false;
    let renderFrame: number | null = null;
    let loadedLayers = 0;
    let loadFailed = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const previousAssetKey = canvas.dataset.renderAsset;
    const previousColour = canvas.dataset.renderColour;
    const hasPreviousComposite =
      previousAssetKey === assetKey &&
      Boolean(previousColour) &&
      canvas.width > 0 &&
      canvas.height > 0;
    canvas.dataset.renderState = "loading";
    delete canvas.dataset.colourTransition;
    notifyRenderProgress({
      state: "loading",
      loadedLayers,
      totalLayers: GARMENT_LAYER_COUNT,
    });

    const context = canvas.getContext("2d");
    if (!context) {
      canvas.dataset.renderState = "error";
      notifyRenderProgress({
        state: "error",
        loadedLayers,
        totalLayers: GARMENT_LAYER_COUNT,
      });
      return;
    }

    if (!hasPreviousComposite) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      delete canvas.dataset.renderColour;
      delete canvas.dataset.renderAsset;
    }
    const renderDimension = getRenderDimension(canvas, renderProfile);

    loadLayers(
      cacheScope,
      exclusiveCacheScope,
      renderDimension,
      maskSrc,
      textureSrc,
      shadowSrc,
      highlightSrc,
      (nextLoadedLayers, totalLayers) => {
        loadedLayers = nextLoadedLayers;
        if (cancelled || loadFailed) return;
        notifyRenderProgress({
          state: "loading",
          loadedLayers: nextLoadedLayers,
          totalLayers,
        });
      },
    )
      .then((layers) => {
        if (cancelled || !canvasRef.current) return;

        const target = canvasRef.current;
        if (target.width !== layers.width) target.width = layers.width;
        if (target.height !== layers.height) target.height = layers.height;
        notifyRenderProgress({
          state: "compositing",
          loadedLayers: GARMENT_LAYER_COUNT,
          totalLayers: GARMENT_LAYER_COUNT,
        });
        target.dataset.renderState = "compositing";

        renderFrame = window.requestAnimationFrame((renderStartedAt) => {
          renderFrame = null;
          if (cancelled || !canvasRef.current) return;
          try {
            const targetContext = target.getContext("2d");
            if (!targetContext) throw new Error("Canvas 2D rendering is unavailable.");

            const incomingCanvas = document.createElement("canvas");
            incomingCanvas.width = layers.width;
            incomingCanvas.height = layers.height;
            const incomingContext = incomingCanvas.getContext("2d");
            if (!incomingContext) throw new Error("Canvas 2D rendering is unavailable.");
            renderComposite(incomingContext, layers, colourHex, renderProfile);

            const shouldAnimateColourChange =
              hasPreviousComposite &&
              previousColour !== colourHex &&
              document.visibilityState !== "hidden" &&
              !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

            const finishRender = () => {
              targetContext.clearRect(0, 0, target.width, target.height);
              targetContext.drawImage(incomingCanvas, 0, 0);
              target.dataset.renderColour = colourHex;
              target.dataset.renderAsset = assetKey;
              target.dataset.renderState = "ready";
              delete target.dataset.colourTransition;
              notifyRenderProgress({
                state: "ready",
                loadedLayers: GARMENT_LAYER_COUNT,
                totalLayers: GARMENT_LAYER_COUNT,
              });
            };

            if (!shouldAnimateColourChange) {
              finishRender();
              return;
            }

            target.dataset.colourTransition = "watercolour";
            const animateReveal = (now: number) => {
              renderFrame = null;
              if (cancelled || !canvasRef.current) return;
              const progress = clamp(
                (now - renderStartedAt) / WATERCOLOUR_TRANSITION_DURATION_MS,
              );
              paintWatercolourReveal(targetContext, incomingCanvas, progress);

              if (progress < 1) {
                renderFrame = window.requestAnimationFrame(animateReveal);
                return;
              }

              finishRender();
            };

            animateReveal(renderStartedAt);
          } catch (error: unknown) {
            target.dataset.renderState = "error";
            delete target.dataset.colourTransition;
            notifyRenderProgress({
              state: "error",
              loadedLayers,
              totalLayers: GARMENT_LAYER_COUNT,
            });
            if (process.env.NODE_ENV !== "production") console.error(error);
          }
        });
      })
      .catch((error: unknown) => {
        if (cancelled || !canvasRef.current) return;
        loadFailed = true;
        canvasRef.current.dataset.renderState = "error";
        delete canvasRef.current.dataset.colourTransition;
        notifyRenderProgress({
          state: "error",
          loadedLayers,
          totalLayers: GARMENT_LAYER_COUNT,
        });
        if (process.env.NODE_ENV !== "production") console.error(error);
      });

    return () => {
      cancelled = true;
      if (renderFrame !== null) window.cancelAnimationFrame(renderFrame);
    };
  }, [
    assetKey,
    cacheScope,
    colourHex,
    exclusiveCacheScope,
    maskSrc,
    renderProfile,
    textureSrc,
    shadowSrc,
    highlightSrc,
  ]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" data-render-state="loading" />;
}
