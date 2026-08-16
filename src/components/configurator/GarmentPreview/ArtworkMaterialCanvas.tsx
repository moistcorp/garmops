"use client";

import { useEffect, useMemo, useRef } from "react";
import type { CustomerArtworkTechnique } from "@/lib/configurator/types/configurator";
import type { ReflectiveColourKey } from "@/lib/configurator/reflectiveColours";
import { getReflectiveColour } from "@/lib/configurator/reflectiveColours";
import type { GarmentFolder } from "./garmentAssets";
import {
  getArtworkDeformationStrength,
  PRINT_MATERIAL_PROFILES,
} from "./printMaterials";

const MAX_PRINT_DIMENSION = 900;
const imageCache = new Map<string, Promise<HTMLImageElement>>();

interface ArtworkMaterialCanvasProps {
  artworkSrc: string;
  technique: CustomerArtworkTechnique;
  garmentFolder: GarmentFolder;
  artworkWidthCm: number;
  box: { left: number; top: number; width: number; height: number };
  garmentInsetPercent: number;
  textureSrc: string;
  shadowSrc: string;
  highlightSrc: string;
  reflectiveColour?: ReflectiveColourKey;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load print preview asset: ${src}`));
    image.src = src;
  });
  imageCache.set(src, promise);
  promise.catch(() => imageCache.delete(src));
  return promise;
}

function drawContained(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  size: number,
  insetPercent: number,
): void {
  const inset = (size * insetPercent) / 100;
  const frame = size - inset * 2;
  const scale = Math.min(frame / image.naturalWidth, frame / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
}

function getLuminance(data: Uint8ClampedArray, offset: number): number {
  return (
    data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722
  );
}

function getLuminanceReference(data: Uint8ClampedArray): number {
  let sum = 0;
  let count = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] === 0) continue;
    sum += getLuminance(data, offset);
    count += 1;
  }
  return count > 0 ? sum / count : 128;
}

export default function ArtworkMaterialCanvas({
  artworkSrc,
  technique,
  garmentFolder,
  artworkWidthCm,
  box,
  garmentInsetPercent,
  textureSrc,
  shadowSrc,
  highlightSrc,
  reflectiveColour,
}: ArtworkMaterialCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const material = PRINT_MATERIAL_PROFILES[technique];
  const reflectiveHex = getReflectiveColour(reflectiveColour).hex;
  const assetKey = useMemo(
    () => [artworkSrc, textureSrc, shadowSrc, highlightSrc].join("|"),
    [artworkSrc, textureSrc, shadowSrc, highlightSrc],
  );

  useEffect(() => {
    let cancelled = false;
    const target = canvasRef.current;
    if (!target) return;
    target.dataset.renderState = "loading";

    Promise.all([
      loadImage(artworkSrc),
      loadImage(textureSrc),
      loadImage(shadowSrc),
      loadImage(highlightSrc),
    ]).then(([artworkImage, textureImage, shadowImage, highlightImage]) => {
      if (cancelled || !canvasRef.current) return;
      const cssWidth = Math.max(1, target.clientWidth);
      const cssHeight = Math.max(1, target.clientHeight);
      const scale = Math.min(
        window.devicePixelRatio || 1,
        MAX_PRINT_DIMENSION / Math.max(cssWidth, cssHeight),
        2,
      );
      const width = Math.max(1, Math.round(cssWidth * scale));
      const height = Math.max(1, Math.round(cssHeight * scale));
      target.width = width;
      target.height = height;

      const signalCanvas = document.createElement("canvas");
      signalCanvas.width = 600;
      signalCanvas.height = 600;
      const signalContext = signalCanvas.getContext("2d", { willReadFrequently: true });
      if (!signalContext) return;
      const readSignal = (image: HTMLImageElement) => {
        signalContext.clearRect(0, 0, 600, 600);
        drawContained(signalContext, image, 600, garmentInsetPercent);
        return signalContext.getImageData(box.left, box.top, box.width, box.height).data;
      };
      const texture = readSignal(textureImage);
      const shadow = readSignal(shadowImage);
      const highlight = readSignal(highlightImage);
      const textureReference = getLuminanceReference(texture);
      const highlightReference = getLuminanceReference(highlight);

      const source = document.createElement("canvas");
      source.width = width;
      source.height = height;
      const sourceContext = source.getContext("2d", { willReadFrequently: true });
      if (!sourceContext) return;
      sourceContext.imageSmoothingEnabled = true;
      sourceContext.imageSmoothingQuality = "high";
      const artworkScale = Math.min(
        width / artworkImage.naturalWidth,
        height / artworkImage.naturalHeight,
      );
      const artworkWidth = artworkImage.naturalWidth * artworkScale;
      const artworkHeight = artworkImage.naturalHeight * artworkScale;
      sourceContext.drawImage(
        artworkImage,
        (width - artworkWidth) / 2,
        (height - artworkHeight) / 2,
        artworkWidth,
        artworkHeight,
      );

      const warped = document.createElement("canvas");
      warped.width = width;
      warped.height = height;
      const warpedContext = warped.getContext("2d");
      if (!warpedContext) return;
      const deformation = getArtworkDeformationStrength(
        technique,
        garmentFolder,
        artworkWidthCm,
      );
      const bands = Math.min(72, Math.max(18, Math.round(height / 8)));
      for (let band = 0; band < bands; band += 1) {
        const sourceY = Math.floor((band / bands) * height);
        const nextY = Math.ceil(((band + 1) / bands) * height);
        const signalY = Math.min(box.height - 1, Math.floor(((band + 0.5) / bands) * box.height));
        const centre = (signalY * box.width + Math.floor(box.width / 2)) * 4;
        const left = (signalY * box.width + Math.floor(box.width * 0.36)) * 4;
        const right = (signalY * box.width + Math.floor(box.width * 0.64)) * 4;
        const foldSlope = (getLuminance(shadow, right) - getLuminance(shadow, left)) / 255;
        const foldDepth = (textureReference - getLuminance(texture, centre)) / 128;
        const shift = clamp(foldSlope * 2.2 + foldDepth * 0.35, -1, 1) * deformation * scale;
        warpedContext.drawImage(
          source,
          0,
          sourceY,
          width,
          Math.max(1, nextY - sourceY),
          shift,
          sourceY,
          width,
          Math.max(1, nextY - sourceY + 1),
        );
      }

      const pixelsContext = warped.getContext("2d", { willReadFrequently: true });
      if (!pixelsContext) return;
      const output = pixelsContext.getImageData(0, 0, width, height);
      const pixels = output.data;
      const reflectiveRgb = technique === "reflective_print"
        ? parseHex(reflectiveHex)
        : undefined;
      for (let y = 0; y < height; y += 1) {
        const sy = Math.min(box.height - 1, Math.floor((y / height) * box.height));
        for (let x = 0; x < width; x += 1) {
          const offset = (y * width + x) * 4;
          if (pixels[offset + 3] === 0) continue;
          // Reflective film is a single selected colour. The uploaded image's
          // alpha remains the cut shape while its original RGB is discarded.
          if (reflectiveRgb) {
            pixels[offset] = reflectiveRgb[0];
            pixels[offset + 1] = reflectiveRgb[1];
            pixels[offset + 2] = reflectiveRgb[2];
          }
          const sx = Math.min(box.width - 1, Math.floor((x / width) * box.width));
          const signalOffset = (sy * box.width + sx) * 4;
          const shadowValue = getLuminance(shadow, signalOffset) / 255;
          const textureValue = getLuminance(texture, signalOffset) / 255;
          const highlightValue = getLuminance(highlight, signalOffset) / 255;
          const macroDarken = (1 - shadowValue) * material.macroShadowTransfer;
          const micro =
            (textureValue - textureReference / 255) * material.microTextureStrength;
          const garmentHighlight =
            Math.max(0, highlightValue - highlightReference / 255) *
            material.macroHighlightTransfer *
            2;
          const directional = (0.65 - x / width) * material.surfaceHighlightStrength;
          const shade = clamp(1 - macroDarken + micro + garmentHighlight + directional, 0.68, 1.16);
          pixels[offset] = clamp(pixels[offset] * shade + 255 * material.elevationStrength, 0, 255);
          pixels[offset + 1] = clamp(pixels[offset + 1] * shade + 255 * material.elevationStrength, 0, 255);
          pixels[offset + 2] = clamp(pixels[offset + 2] * shade + 255 * material.elevationStrength, 0, 255);
        }
      }
      pixelsContext.putImageData(output, 0, 0);

      const context = target.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, width, height);
      context.drawImage(warped, 0, 0);
      target.dataset.renderState = "ready";
    }).catch((error: unknown) => {
      target.dataset.renderState = "error";
      if (process.env.NODE_ENV !== "production") console.error(error);
    });

    return () => {
      cancelled = true;
    };
  }, [assetKey, artworkSrc, artworkWidthCm, box, garmentFolder, garmentInsetPercent, highlightSrc, material, reflectiveHex, shadowSrc, technique, textureSrc]);

  return <canvas ref={canvasRef} className="h-full w-full object-contain" aria-hidden="true" data-artwork-technique={technique} data-render-state="loading" />;
}

function parseHex(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}
