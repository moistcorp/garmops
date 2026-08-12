import { describe, expect, it } from "vitest";
import { getGarmentInsetPercent, getGarmentPrintArea } from "./garmentGeometry";
import {
  constrainArtworkToPrintArea,
  DEFAULT_POSITION_STATE,
  getArtworkPlacementBounds,
} from "./ArtworkPositionContext";

describe("garment-relative print area calibration", () => {
  it("keeps the Classic T-Shirt guide inside the calibrated front body", () => {
    const area = getGarmentPrintArea("regular-fit-tee-200gsm", "front");

    expect(area).toBeDefined();
    expect(area!.topPx).toBeGreaterThan(0);
    expect(area!.bottomPx).toBeLessThan(600);
    expect(area!.leftPx).toBeGreaterThan(0);
    expect(area!.rightPx).toBeLessThan(600);
    expect(area!.height).toBeGreaterThan(0);
    expect(area!.width).toBeGreaterThan(0);
  });

  it("uses the calibrated area origin when constraining artwork", () => {
    const area = getGarmentPrintArea("regular-fit-tee-200gsm", "front")!;
    const bounds = getArtworkPlacementBounds(DEFAULT_POSITION_STATE, area);
    const constrained = constrainArtworkToPrintArea(
      {
        ...DEFAULT_POSITION_STATE,
        fromNeckCm: 200,
        fromCenterCm: 200,
      },
      area,
    );

    expect(bounds.minFromNeckCm).toBe(area.origin.topOffsetCm);
    expect(bounds.minFromCenterCm).toBeLessThan(area.origin.centerOffsetCm);
    expect(constrained.fromNeckCm).toBe(bounds.maxFromNeckCm);
    expect(constrained.fromCenterCm).toBe(bounds.maxFromCenterCm);
  });

  it("does not apply the large front/back area to the neck view", () => {
    expect(getGarmentPrintArea("regular-fit-tee-200gsm", "neck")).toBeUndefined();
  });

  it("uses the per-product frame when mapping print areas", () => {
    expect(getGarmentInsetPercent("regular-fit-tee-200gsm", "front")).toBe(1);
    expect(getGarmentInsetPercent("boxy-fit-tee-260gsm", "front")).toBe(1);
    expect(getGarmentInsetPercent("regular-fit-hoodie-320gsm", "front")).toBe(-3.5);
    expect(getGarmentInsetPercent("canvas-tote-bag", "front")).toBe(-5);

    for (const productId of [
      "boxy-fit-tee-260gsm",
      "longsleeve-tee-260gsm",
      "polo-280gsm",
      "regular-fit-sweatshirt-320gsm",
      "regular-fit-hoodie-320gsm",
      "boxy-fit-hoodie-320gsm",
      "canvas-tote-bag",
    ] as const) {
      for (const view of ["front", "back"] as const) {
        const area = getGarmentPrintArea(productId, view);
        expect(area, `${productId} ${view}`).toBeDefined();
        expect(area!.leftPx, `${productId} ${view} left`).toBeGreaterThanOrEqual(0);
        expect(area!.rightPx, `${productId} ${view} right`).toBeLessThanOrEqual(600);
        expect(area!.topPx, `${productId} ${view} top`).toBeGreaterThanOrEqual(0);
        expect(area!.bottomPx, `${productId} ${view} bottom`).toBeLessThanOrEqual(600);
      }
    }
  });
});
