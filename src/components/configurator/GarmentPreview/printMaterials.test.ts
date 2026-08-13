import { describe, expect, it } from "vitest";
import {
  getArtworkDeformationStrength,
  PRINT_MATERIAL_PROFILES,
} from "./printMaterials";

describe("print preview materials", () => {
  it("keeps technique profiles visibly and physically distinct", () => {
    expect(PRINT_MATERIAL_PROFILES.screen_print.microTextureStrength).toBeGreaterThan(
      PRINT_MATERIAL_PROFILES.dtf.microTextureStrength,
    );
    expect(PRINT_MATERIAL_PROFILES.dtf.surfaceHighlightStrength).toBeGreaterThan(
      PRINT_MATERIAL_PROFILES.screen_print.surfaceHighlightStrength,
    );
    expect(PRINT_MATERIAL_PROFILES.reflective_print.microTextureStrength).toBeLessThan(
      PRINT_MATERIAL_PROFILES.screen_print.microTextureStrength,
    );
  });

  it("scales deformation by print size and garment structure", () => {
    const small = getArtworkDeformationStrength("screen_print", "regular-fit-tee", 8);
    const large = getArtworkDeformationStrength("screen_print", "regular-fit-tee", 30);
    const tote = getArtworkDeformationStrength("screen_print", "canvas-tote-bag", 30);
    expect(large).toBeGreaterThan(small);
    expect(tote).toBeLessThan(large / 2);
  });
});
