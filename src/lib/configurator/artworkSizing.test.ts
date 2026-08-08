import { describe, expect, it } from "vitest";
import { getArtworkSizeConflict } from "./artworkSizing";

const artwork = {
  smallestSize: "M" as const,
  front: {
    fileUrl: "blob:front",
    fileType: "png" as const,
    vectorized: false,
    width: 34,
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
      actualSmallestSize: "S",
      smallerSizes: ["S"],
      unsafeSides: ["front"],
    });
  });

  it("allows the configured size and larger sizes", () => {
    expect(getArtworkSizeConflict(artwork, { M: 8, L: 2 })).toBeNull();
  });

  it("allows a smaller ordered size when the artwork still fits its safe area", () => {
    expect(getArtworkSizeConflict({
      ...artwork,
      front: { ...artwork.front, width: 20, height: 8 },
    }, { S: 2, M: 8 })).toBeNull();
  });

  it("detects placement overflow even when artwork dimensions fit", () => {
    expect(getArtworkSizeConflict({
      ...artwork,
      front: { ...artwork.front, width: 20, fromCenter: 7 },
    }, { S: 2, M: 8 })?.unsafeSides).toEqual(["front"]);
  });
});
