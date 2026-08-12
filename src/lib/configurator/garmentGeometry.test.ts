import { describe, expect, it } from "vitest";
import { getGarmentPrintArea } from "./garmentGeometry";
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
});
