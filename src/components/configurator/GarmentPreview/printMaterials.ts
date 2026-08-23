import type { CustomerArtworkTechnique } from "@/lib/configurator/types/configurator";
import type { GarmentFolder } from "./garmentAssets";

export interface PrintMaterialProfile {
  macroShadowTransfer: number;
  macroHighlightTransfer: number;
  microTextureStrength: number;
  elevationStrength: number;
  surfaceHighlightStrength: number;
  deformationStrength: number;
}

/**
 * Preview-only material values. Keeping these together makes a new print
 * process a profile addition, rather than another collection of CSS effects.
 */
export const PRINT_MATERIAL_PROFILES: Record<
  CustomerArtworkTechnique,
  Readonly<PrintMaterialProfile>
> = {
  screen_print: {
    macroShadowTransfer: 0.16,
    macroHighlightTransfer: 0.08,
    microTextureStrength: 0.035,
    elevationStrength: 0,
    surfaceHighlightStrength: 0,
    deformationStrength: 1,
  },
  dtf: {
    macroShadowTransfer: 0.12,
    macroHighlightTransfer: 0.07,
    microTextureStrength: 0.025,
    elevationStrength: 0.025,
    surfaceHighlightStrength: 0.045,
    deformationStrength: 0.72,
  },
  reflective_print: {
    macroShadowTransfer: 0.1,
    macroHighlightTransfer: 0.1,
    microTextureStrength: 0.015,
    elevationStrength: 0.02,
    surfaceHighlightStrength: 0.075,
    deformationStrength: 0.68,
  },
};

const GARMENT_DEFORMATION: Record<GarmentFolder, number> = {
  "regular-fit-tee": 1,
  "boxy-fit-tee": 0.95,
  "longsleeve-tee": 1,
  polo: 0.82,
  "regular-fit-sweatshirt": 0.88,
  "regular-fit-hoodie": 1.08,
  "canvas-tote-bag": 0.28,
};

export function getArtworkDeformationStrength(
  technique: CustomerArtworkTechnique,
  garment: GarmentFolder,
  artworkWidthCm: number,
): number {
  // Small chest marks stay almost geometrically perfect; broad prints inherit
  // more of the photographed surface, without exceeding a two-pixel warp.
  const sizeFactor = Math.max(0.12, Math.min(1, (artworkWidthCm - 6) / 24));
  return (
    PRINT_MATERIAL_PROFILES[technique].deformationStrength *
    GARMENT_DEFORMATION[garment] *
    sizeFactor
  );
}
