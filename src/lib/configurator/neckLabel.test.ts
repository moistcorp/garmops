import { describe, expect, it } from "vitest";
import {
  createStandardNeckLabel,
  isCustomNeckLabel,
  neckLabelStitchesForPosition,
  normalizeNeckLabelStitch,
} from "./neckLabel";

describe("neck label state", () => {
  it("keeps standard size labels explicit without treating them as custom assets", () => {
    const standard = createStandardNeckLabel();
    expect(standard.labelType).toBe("standard-size");
    expect(isCustomNeckLabel(standard)).toBe(false);
    expect(isCustomNeckLabel({ ...standard, labelType: "custom", fileUrl: "" })).toBe(true);
  });

  it("restricts on-tape labels to the two-corner stitch", () => {
    expect(neckLabelStitchesForPosition("on_neck_tape")).toEqual(["2_corner"]);
    expect(normalizeNeckLabelStitch("on_neck_tape", "4_corner")).toBe("2_corner");
    expect(normalizeNeckLabelStitch("below_neck_tape", "4_corner")).toBe("4_corner");
  });
});
