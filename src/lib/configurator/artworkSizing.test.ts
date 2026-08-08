import { describe, expect, it } from "vitest";
import { getArtworkSizeConflict } from "./artworkSizing";

const artwork = {
  smallestSize: "M" as const,
  front: {
    fileUrl: "blob:front",
    fileType: "png" as const,
    vectorized: false,
    width: 20,
    height: 8,
    fromNeck: 8,
    fromCenter: 0,
    printArea: "M" as const,
    guidelines: { maximumArea: true, leftChest: false },
    confirmed: false,
  },
};

describe("artwork size allocation safety", () => {
  it("finds a smaller allocated garment size", () => {
    expect(getArtworkSizeConflict(artwork, { S: 2, M: 8 })).toEqual({
      configuredFor: "M",
      smallerSizes: ["S"],
    });
  });

  it("allows the configured size and larger sizes", () => {
    expect(getArtworkSizeConflict(artwork, { M: 8, L: 2 })).toBeNull();
  });
});
