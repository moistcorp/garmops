import { describe, expect, it } from "vitest";
import { createStandardNeckLabel, isCustomNeckLabel } from "./neckLabel";

describe("neck label state", () => {
  it("keeps standard size labels explicit without treating them as custom assets", () => {
    const standard = createStandardNeckLabel();
    expect(standard.labelType).toBe("standard-size");
    expect(isCustomNeckLabel(standard)).toBe(false);
    expect(isCustomNeckLabel({ ...standard, labelType: "custom", fileUrl: "" })).toBe(true);
  });
});
