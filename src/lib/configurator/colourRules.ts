// Lightweight garment-colour rules used across the configurator. This module
// deliberately contains no Pantone-table import so MOQ, pricing and signature
// swatches stay in the initial client bundle without pulling the full library.

export interface SignatureColour {
  id: string;
  name: string;
  hex: string;
}

export const SIGNATURE_COLOURS = [
  { id: "jet-black", name: "Jet Black", hex: "#161616" },
  { id: "classic-white", name: "Classic White", hex: "#F5F5F2" },
  { id: "navy-blue", name: "Navy Blue", hex: "#202C46" },
  { id: "charcoal-grey", name: "Charcoal Grey", hex: "#414345" },
  { id: "heather-grey", name: "Heather Grey", hex: "#B6B7B4" },
  { id: "bottle-green", name: "Bottle Green", hex: "#234936" },
  { id: "burgundy", name: "Burgundy", hex: "#722F3D" },
  { id: "sand", name: "Sand", hex: "#D2C2A8" },
] as const satisfies readonly SignatureColour[];

export function resolveSignatureColour(
  colour: { id?: string; name: string; hex: string },
): SignatureColour | undefined {
  return SIGNATURE_COLOURS.find(
    (candidate) =>
      candidate.id === colour.id ||
      (candidate.name === colour.name &&
        candidate.hex.toUpperCase() === colour.hex.toUpperCase()),
  );
}

// ============================================================
// Custom Dye disclosure — MOQ / lead-time tradeoffs vs Signature.
// Shown inline before selection so the impact isn't a surprise later
// in OrderBar.
// ============================================================
export const CUSTOM_DYE_MOQ_UNITS = 100;
export const CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS: { min: number; max: number } = {
  min: 12,
  max: 15,
};
