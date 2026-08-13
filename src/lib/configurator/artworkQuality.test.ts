import { describe, expect, it } from "vitest";
import { effectiveArtworkPpi, getArtworkQuality } from "./artworkQuality";

describe("artwork quality", () => {
  it("uses physical print size for raster quality", () => {
    const side = {
      fileType: "png" as const,
      vectorized: false,
      pixelWidth: 3000,
      pixelHeight: 1200,
      width: 10,
      height: 4,
    };
    expect(Math.round(effectiveArtworkPpi(side) ?? 0)).toBe(762);
    expect(getArtworkQuality({ ...side, fromNeck: 8, fromCenter: 0, printArea: "M", guidelines: { maximumArea: true, leftChest: false }, confirmed: false, fileUrl: "blob:image" })?.label).toBe("Good at this size");
  });

  it("does not apply raster warnings to vector artwork", () => {
    expect(getArtworkQuality({ fileUrl: "blob:ai", fileType: "ai", vectorized: true, width: 30, height: 10, fromNeck: 8, fromCenter: 0, printArea: "M", guidelines: { maximumArea: true, leftChest: false }, confirmed: false })?.label).toBe("Vector artwork");
  });

  it("does not call a raster source vector artwork just because its preview is normalized", () => {
    const side = {
      fileUrl: "blob:source",
      fileType: "png" as const,
      vectorized: false,
      previewKind: "raster" as const,
      sourceIsVector: false,
      pixelWidth: 300,
      pixelHeight: 300,
      width: 10,
      height: 10,
      fromNeck: 8,
      fromCenter: 0,
      printArea: "M" as const,
      guidelines: { maximumArea: true, leftChest: false },
      confirmed: false,
    };
    expect(getArtworkQuality(side)?.isVector).toBe(false);
    expect(getArtworkQuality(side)?.label).toBe("May print soft at this size");
  });
});
