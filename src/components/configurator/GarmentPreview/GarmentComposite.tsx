"use client";

import { useEffect, useMemo, useRef } from "react";

const MAX_RENDER_DIMENSION = 1200;

interface GarmentCompositeProps {
  maskSrc: string;
  textureSrc: string;
  shadowSrc: string;
  highlightSrc: string;
  colourHex: string;
  className?: string;
}

interface LayerPixels {
  width: number;
  height: number;
  mask: Uint8ClampedArray;
  texture: Uint8ClampedArray;
  shadow: Uint8ClampedArray;
  highlight: Uint8ClampedArray;
}

const layerCache = new Map<string, Promise<LayerPixels>>();

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const progress = clamp((value - edge0) / (edge1 - edge0));
  return progress * progress * (3 - 2 * progress);
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
    displayLightness = 0.115 + (lightness / 0.22) * 0.105;
  } else if (lightness > 0.78) {
    displayLightness = 0.78 + ((lightness - 0.78) / 0.22) * 0.15;
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
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load garment preview asset: ${src}`));
    image.src = src;
  });
}

function imagePixels(
  image: HTMLImageElement,
  width: number,
  height: number
): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D rendering is unavailable.");

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
}

function loadLayers(
  maskSrc: string,
  textureSrc: string,
  shadowSrc: string,
  highlightSrc: string
): Promise<LayerPixels> {
  const cacheKey = [maskSrc, textureSrc, shadowSrc, highlightSrc].join("|");
  const cached = layerCache.get(cacheKey);
  if (cached) return cached;

  const promise = Promise.all([
    loadImage(maskSrc),
    loadImage(textureSrc),
    loadImage(shadowSrc),
    loadImage(highlightSrc),
  ]).then(([maskImage, textureImage, shadowImage, highlightImage]) => {
    const sourceWidth = maskImage.naturalWidth;
    const sourceHeight = maskImage.naturalHeight;
    const scale = Math.min(1, MAX_RENDER_DIMENSION / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    return {
      width,
      height,
      mask: imagePixels(maskImage, width, height),
      texture: imagePixels(textureImage, width, height),
      shadow: imagePixels(shadowImage, width, height),
      highlight: imagePixels(highlightImage, width, height),
    };
  });

  layerCache.set(cacheKey, promise);
  promise.catch(() => layerCache.delete(cacheKey));
  return promise;
}

function luminance(data: Uint8ClampedArray, offset: number): number {
  return data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
}

function renderComposite(
  context: CanvasRenderingContext2D,
  layers: LayerPixels,
  colourHex: string
): void {
  const { width, height, mask, texture, shadow, highlight } = layers;
  const output = context.createImageData(width, height);
  const pixels = output.data;
  const [baseRed, baseGreen, baseBlue] = getDisplayPreviewColour(colourHex);
  const baseLuminance =
    (baseRed * 0.2126 + baseGreen * 0.7152 + baseBlue * 0.0722) / 255;

  const darkProfile = smoothstep(0.45, 0.1, baseLuminance);
  const lightProfile = smoothstep(0.65, 0.95, baseLuminance);
  const shadowStrength = 0.24 + 0.1 * lightProfile - 0.1 * darkProfile;
  const grainStrength = 0.08 + 0.04 * lightProfile - 0.035 * darkProfile;
  const highlightStrength = 0.035 + 0.07 * darkProfile - 0.02 * lightProfile;
  const darkColourLift = 0.018 * darkProfile;

  for (let offset = 0; offset < pixels.length; offset += 4) {
    const alpha = mask[offset + 3] / 255;
    if (alpha <= 0) continue;

    const textureLuminance = luminance(texture, offset);
    const shadowLuminance = luminance(shadow, offset);
    const highlightLuminance = luminance(highlight, offset);

    const shadowSignal = Math.pow(
      clamp(Math.max((250 - shadowLuminance) / 105, (246 - textureLuminance) / 145)),
      0.85
    );
    const grainSignal = Math.pow(clamp((252 - textureLuminance) / 65), 1);
    const highlightSignal = Math.pow(clamp((highlightLuminance - 0.5) / 16.5), 1.15);

    const darken = (1 - shadowSignal * shadowStrength) * (1 - grainSignal * grainStrength);
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

export default function GarmentComposite({
  maskSrc,
  textureSrc,
  shadowSrc,
  highlightSrc,
  colourHex,
  className = "absolute inset-0 h-full w-full object-contain",
}: GarmentCompositeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const assetKey = useMemo(
    () => [maskSrc, textureSrc, shadowSrc, highlightSrc].join("|"),
    [maskSrc, textureSrc, shadowSrc, highlightSrc]
  );

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    loadLayers(maskSrc, textureSrc, shadowSrc, highlightSrc)
      .then((layers) => {
        if (cancelled || !canvasRef.current) return;

        const target = canvasRef.current;
        if (target.width !== layers.width) target.width = layers.width;
        if (target.height !== layers.height) target.height = layers.height;

        const targetContext = target.getContext("2d");
        if (!targetContext) return;
        renderComposite(targetContext, layers, colourHex);
      })
      .catch((error: unknown) => {
        if (process.env.NODE_ENV !== "production") console.error(error);
      });

    return () => {
      cancelled = true;
    };
  }, [assetKey, colourHex, maskSrc, textureSrc, shadowSrc, highlightSrc]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
