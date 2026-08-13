import { describe, expect, it } from "vitest";
import { analyseRasterPixels } from "./raster";

function rgba(values: number[]): Uint8ClampedArray {
  return new Uint8ClampedArray(values);
}

describe("raster artwork analysis", () => {
  it("recognizes a transparent flat graphic candidate", () => {
    const pixels = rgba([
      0, 0, 0, 0, 0, 0, 0, 0,
      255, 0, 0, 255, 255, 0, 0, 255,
      0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    const result = analyseRasterPixels(pixels, 2, 2, 200, 200);
    expect(result.hasTransparency).toBe(true);
    expect(result.isFlatGraphicCandidate).toBe(true);
    expect(result.isContinuousTone).toBe(false);
    expect(result.pixelWidth).toBe(200);
  });

  it("detects a uniform opaque border without classifying it as a photo", () => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    for (let index = 0; index < pixels.length; index += 4) {
      pixels[index] = 255;
      pixels[index + 1] = 255;
      pixels[index + 2] = 255;
      pixels[index + 3] = 255;
    }
    const centre = (1 * 4 + 1) * 4;
    pixels[centre] = 20;
    pixels[centre + 1] = 20;
    pixels[centre + 2] = 20;
    const result = analyseRasterPixels(pixels, 4, 4, 300, 300);
    expect(result.background?.confidence).toBeGreaterThan(0.97);
    expect(result.background?.color).toBe("#FFFFFF");
  });
});
