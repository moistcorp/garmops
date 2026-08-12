import type { ProductId } from "@/lib/configurator/pricing";
import type { GarmentView } from "@/lib/configurator/types/garment";
import type { ArtworkPlacementArea } from "@/lib/configurator/sizecharts";
import { getSizeChart } from "@/lib/sizecharts";
import {
  getGarmentFolder,
  getGarmentRenderConfig,
} from "@/components/configurator/GarmentPreview/garmentAssets";
import {
  CANVAS_PX,
  PRINT_ORIGIN_PX,
  PX_PER_CM_X,
  PX_PER_CM_Y,
} from "@/lib/configurator/ArtworkPositionContext";

export interface GarmentLandmarks {
  /** Normalized to the source garment asset, rather than the browser canvas. */
  neckRibBottomY: number;
  hemTopY: number;
  torsoLeftX: number;
  torsoRightX: number;
}

export interface GarmentPrintArea extends ArtworkPlacementArea {
  leftPx: number;
  topPx: number;
  rightPx: number;
  bottomPx: number;
  landmarks: GarmentLandmarks;
}

interface GarmentCalibration {
  assetAspectRatio: number;
  bodyLengthFallbackInches: number;
  torsoWidthInches: number;
  front: GarmentLandmarks;
  back: GarmentLandmarks;
}

const STANDARD_ASSET_ASPECT_RATIO = 1670 / 1494;

// These landmarks are calibrated against the supplied mask/detail plates. They
// stay in asset space so CSS sizing, browser zoom and the preview container do
// not change the physical relationship between the guide and the garment.
const CALIBRATIONS: Record<string, GarmentCalibration> = {
  "regular-fit-tee": {
    assetAspectRatio: 4998 / 4468,
    bodyLengthFallbackInches: 27,
    torsoWidthInches: 21,
    front: { neckRibBottomY: 0.145, hemTopY: 0.965, torsoLeftX: 0.216, torsoRightX: 0.785 },
    back: { neckRibBottomY: 0.14, hemTopY: 0.968, torsoLeftX: 0.223, torsoRightX: 0.779 },
  },
  "boxy-fit-tee": {
    assetAspectRatio: STANDARD_ASSET_ASPECT_RATIO,
    bodyLengthFallbackInches: 29,
    torsoWidthInches: 23,
    front: { neckRibBottomY: 0.20, hemTopY: 0.90, torsoLeftX: 0.25, torsoRightX: 0.75 },
    back: { neckRibBottomY: 0.20, hemTopY: 0.902, torsoLeftX: 0.25, torsoRightX: 0.75 },
  },
  "longsleeve-tee": {
    assetAspectRatio: STANDARD_ASSET_ASPECT_RATIO,
    bodyLengthFallbackInches: 27,
    torsoWidthInches: 21,
    front: { neckRibBottomY: 0.20, hemTopY: 0.905, torsoLeftX: 0.25, torsoRightX: 0.75 },
    back: { neckRibBottomY: 0.20, hemTopY: 0.907, torsoLeftX: 0.25, torsoRightX: 0.75 },
  },
  polo: {
    assetAspectRatio: STANDARD_ASSET_ASPECT_RATIO,
    bodyLengthFallbackInches: 27,
    torsoWidthInches: 21,
    front: { neckRibBottomY: 0.20, hemTopY: 0.945, torsoLeftX: 0.20, torsoRightX: 0.80 },
    back: { neckRibBottomY: 0.19, hemTopY: 0.948, torsoLeftX: 0.20, torsoRightX: 0.80 },
  },
  "regular-fit-sweatshirt": {
    assetAspectRatio: STANDARD_ASSET_ASPECT_RATIO,
    bodyLengthFallbackInches: 26.5,
    torsoWidthInches: 23.5,
    front: { neckRibBottomY: 0.20, hemTopY: 0.905, torsoLeftX: 0.25, torsoRightX: 0.75 },
    back: { neckRibBottomY: 0.16, hemTopY: 0.928, torsoLeftX: 0.25, torsoRightX: 0.75 },
  },
  "regular-fit-hoodie": {
    assetAspectRatio: STANDARD_ASSET_ASPECT_RATIO,
    bodyLengthFallbackInches: 26.5,
    torsoWidthInches: 24,
    front: { neckRibBottomY: 0.32, hemTopY: 0.96, torsoLeftX: 0.20, torsoRightX: 0.80 },
    back: { neckRibBottomY: 0.18, hemTopY: 0.945, torsoLeftX: 0.16, torsoRightX: 0.84 },
  },
  "boxy-fit-hoodie": {
    assetAspectRatio: STANDARD_ASSET_ASPECT_RATIO,
    bodyLengthFallbackInches: 28,
    torsoWidthInches: 25,
    front: { neckRibBottomY: 0.31, hemTopY: 0.96, torsoLeftX: 0.20, torsoRightX: 0.80 },
    back: { neckRibBottomY: 0.18, hemTopY: 0.96, torsoLeftX: 0.14, torsoRightX: 0.86 },
  },
  "canvas-tote-bag": {
    assetAspectRatio: STANDARD_ASSET_ASPECT_RATIO,
    bodyLengthFallbackInches: 42 / 2.54,
    torsoWidthInches: 38,
    front: { neckRibBottomY: 0.12, hemTopY: 0.97, torsoLeftX: 0.34, torsoRightX: 0.66 },
    back: { neckRibBottomY: 0.12, hemTopY: 0.97, torsoLeftX: 0.34, torsoRightX: 0.66 },
  },
};

const DEFAULT_CALIBRATION: GarmentCalibration = {
  assetAspectRatio: STANDARD_ASSET_ASPECT_RATIO,
  bodyLengthFallbackInches: 27,
  torsoWidthInches: 21,
  front: { neckRibBottomY: 0.2, hemTopY: 0.9, torsoLeftX: 0.25, torsoRightX: 0.75 },
  back: { neckRibBottomY: 0.19, hemTopY: 0.91, torsoLeftX: 0.25, torsoRightX: 0.75 },
};

function parseInches(value?: string): number | undefined {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getBodyLengthInches(productId: ProductId, calibration: GarmentCalibration): number {
  const chart = getSizeChart(productId);
  const size = chart?.sizes.find((row) => row.size === "L" && row.length) ?? chart?.sizes.find((row) => row.length);
  return parseInches(size?.length) ?? calibration.bodyLengthFallbackInches;
}

export function getGarmentInsetPercent(productId: ProductId, view: GarmentView): number {
  return getGarmentRenderConfig(productId, view).insetPercent;
}

export function getGarmentPrintArea(
  productId: ProductId,
  view: GarmentView,
  garmentInsetPercent = getGarmentInsetPercent(productId, view),
): GarmentPrintArea | undefined {
  if (view !== "front" && view !== "back") return undefined;

  const folder = getGarmentFolder(productId) ?? "";
  const calibration = CALIBRATIONS[folder] ?? DEFAULT_CALIBRATION;
  const landmarks = calibration[view];
  const bodyLengthInches = getBodyLengthInches(productId, calibration);

  const inset = (CANVAS_PX.width * garmentInsetPercent) / 100;
  const innerSize = CANVAS_PX.width - inset * 2;
  const imageWidth = innerSize;
  const imageHeight = imageWidth / calibration.assetAspectRatio;
  const imageLeft = inset;
  // object-fit: contain vertically centres the bitmap inside the inset frame.
  // Preserve the benchmark tee's established geometry, while matching the
  // actual CSS frame for every newly calibrated asset set.
  const imageTop =
    (CANVAS_PX.height - imageHeight) / 2 +
    (folder === "regular-fit-tee" ? inset : 0);
  const xFromAsset = (normalized: number) => imageLeft + normalized * imageWidth;
  const yFromAsset = (normalized: number) => imageTop + normalized * imageHeight;

  const neckRibBottomPx = yFromAsset(landmarks.neckRibBottomY);
  const hemTopPx = yFromAsset(landmarks.hemTopY);
  const visibleBodyHeightPx = Math.max(1, hemTopPx - neckRibBottomPx);
  const pixelsPerInchY = visibleBodyHeightPx / bodyLengthInches;
  const pixelsPerInchX =
    Math.max(1, xFromAsset(landmarks.torsoRightX) - xFromAsset(landmarks.torsoLeftX)) /
    calibration.torsoWidthInches;

  const topPx = neckRibBottomPx + pixelsPerInchY * 3;
  const bottomPx = hemTopPx - pixelsPerInchY * 1.5;
  const leftPx = xFromAsset(landmarks.torsoLeftX) + pixelsPerInchX * 1.5;
  const rightPx = xFromAsset(landmarks.torsoRightX) - pixelsPerInchX * 1.5;

  const safeLeftPx = Math.max(imageLeft, Math.min(leftPx, rightPx));
  const safeRightPx = Math.max(safeLeftPx, Math.min(rightPx, imageLeft + imageWidth));
  const safeTopPx = Math.max(neckRibBottomPx, Math.min(topPx, bottomPx));
  const safeBottomPx = Math.max(safeTopPx, Math.min(bottomPx, hemTopPx));

  return {
    width: Math.max(1, (safeRightPx - safeLeftPx) / PX_PER_CM_X),
    height: Math.max(1, (safeBottomPx - safeTopPx) / PX_PER_CM_Y),
    origin: {
      topOffsetCm: (safeTopPx - PRINT_ORIGIN_PX.y) / PX_PER_CM_Y,
      centerOffsetCm: ((safeLeftPx + safeRightPx) / 2 - PRINT_ORIGIN_PX.x) / PX_PER_CM_X,
    },
    leftPx: safeLeftPx,
    topPx: safeTopPx,
    rightPx: safeRightPx,
    bottomPx: safeBottomPx,
    landmarks,
  };
}
