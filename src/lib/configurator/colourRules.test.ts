import { describe, expect, it } from "vitest";

import {
  resolveSignatureColour,
  SIGNATURE_COLOURS,
} from "./colourRules";

describe("signature colour palette", () => {
  it("exposes exactly the curated palette in its specified order", () => {
    expect(SIGNATURE_COLOURS).toEqual([
      { id: "jet-black", name: "Jet Black", hex: "#161616" },
      { id: "classic-white", name: "Classic White", hex: "#F5F5F2" },
      { id: "navy-blue", name: "Navy Blue", hex: "#202C46" },
      { id: "charcoal-grey", name: "Charcoal Grey", hex: "#414345" },
      { id: "heather-grey", name: "Heather Grey", hex: "#B6B7B4" },
      { id: "bottle-green", name: "Bottle Green", hex: "#234936" },
      { id: "burgundy", name: "Burgundy", hex: "#722F3D" },
      { id: "sand", name: "Sand", hex: "#D2C2A8" },
    ]);
  });

  it("resolves current values and rejects removed values", () => {
    expect(resolveSignatureColour({ id: "bottle-green", name: "Bottle Green", hex: "#234936" })).toMatchObject({
      id: "bottle-green",
    });
    expect(resolveSignatureColour({ id: "legacy-colour", name: "Legacy Colour", hex: "#000000" })).toBeUndefined();
  });
});
