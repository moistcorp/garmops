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
  printMarginsInches?: {
    top: number;
    bottom: number;
    side: number;
  };
  front: GarmentLandmarks;
  back: GarmentLandmarks;
}

const STANDARD_ASSET_ASPECT_RATIO = 1670 / 1494;
const HIGH_RES_ASSET_ASPECT_RATIO = 7817 / 5542;

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
    assetAspectRatio: HIGH_RES_ASSET_ASPECT_RATIO,
    bodyLengthFallbackInches: 29,
    torsoWidthInches: 23,
    front: { neckRibBottomY: 0.20, hemTopY: 0.89, torsoLeftX: 0.304, torsoRightX: 0.703 },
    back: { neckRibBottomY: 0.20, hemTopY: 0.89, torsoLeftX: 0.303, torsoRightX: 0.701 },
  },
  "longsleeve-tee": {
    assetAspectRatio: HIGH_RES_ASSET_ASPECT_RATIO,
    bodyLengthFallbackInches: 27,
    torsoWidthInches: 21,
    front: { neckRibBottomY: 0.18, hemTopY: 0.89, torsoLeftX: 0.308, torsoRightX: 0.690 },
    back: { neckRibBottomY: 0.18, hemTopY: 0.89, torsoLeftX: 0.305, torsoRightX: 0.680 },
  },
  polo: {
    assetAspectRatio: HIGH_RES_ASSET_ASPECT_RATIO,
    bodyLengthFallbackInches: 27,
    torsoWidthInches: 21,
    front: { neckRibBottomY: 0.20, hemTopY: 0.89, torsoLeftX: 0.287, torsoRightX: 0.713 },
    back: { neckRibBottomY: 0.19, hemTopY: 0.89, torsoLeftX: 0.290, torsoRightX: 0.710 },
  },
  "regular-fit-sweatshirt": {
    assetAspectRatio: HIGH_RES_ASSET_ASPECT_RATIO,
    bodyLengthFallbackInches: 26.5,
    torsoWidthInches: 23.5,
    front: { neckRibBottomY: 0.18, hemTopY: 0.89, torsoLeftX: 0.298, torsoRightX: 0.694 },
    back: { neckRibBottomY: 0.16, hemTopY: 0.89, torsoLeftX: 0.301, torsoRightX: 0.696 },
  },
  "regular-fit-hoodie": {
    assetAspectRatio: HIGH_RES_ASSET_ASPECT_RATIO,
    bodyLengthFallbackInches: 26.5,
    torsoWidthInches: 24,
    front: { neckRibBottomY: 0.34, hemTopY: 0.89, torsoLeftX: 0.343, torsoRightX: 0.653 },
    back: { neckRibBottomY: 0.31, hemTopY: 0.89, torsoLeftX: 0.330, torsoRightX: 0.673 },
  },
  "boxy-fit-hoodie": {
    assetAspectRatio: HIGH_RES_ASSET_ASPECT_RATIO,
    bodyLengthFallbackInches: 28,
    torsoWidthInches: 25,
    front: { neckRibBottomY: 0.34, hemTopY: 0.89, torsoLeftX: 0.330, torsoRightX: 0.673 },
    back: { neckRibBottomY: 0.31, hemTopY: 0.89, torsoLeftX: 0.330, torsoRightX: 0.673 },
  },
  "canvas-tote-bag": {
    assetAspectRatio: 5280 / 4736,
    bodyLengthFallbackInches: 42 / 2.54,
    torsoWidthInches: 38 / 2.54,
    // A 30×30 cm production area on the 38×42 cm bag panel.
    printMarginsInches: {
      top: 6 / 2.54,
      bottom: 6 / 2.54,
      side: 4 / 2.54,
    },
    // For a tote, the "neck" landmark is the bag panel's top seam. Keeping
    // handle pixels outside these landmarks prevents artwork entering the gap.
    front: { neckRibBottomY: 0.43, hemTopY: 0.971, torsoLeftX: 0.284, torsoRightX: 0.717 },
    back: { neckRibBottomY: 0.431, hemTopY: 0.972, torsoLeftX: 0.284, torsoRightX: 0.717 },
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
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return /cm\b/i.test(value ?? "") ? parsed / 2.54 : parsed;
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
  const printMargins = calibration.printMarginsInches ?? {
    top: 3,
    bottom: 1.5,
    side: 1.5,
  };

  const topPx = neckRibBottomPx + pixelsPerInchY * printMargins.top;
  const bottomPx = hemTopPx - pixelsPerInchY * printMargins.bottom;
  const leftPx = xFromAsset(landmarks.torsoLeftX) + pixelsPerInchX * printMargins.side;
  const rightPx = xFromAsset(landmarks.torsoRightX) - pixelsPerInchX * printMargins.side;

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
