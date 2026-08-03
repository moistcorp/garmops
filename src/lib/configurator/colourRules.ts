// Lightweight garment-colour rules used across the configurator. This module
// deliberately contains no Pantone-table import so MOQ, pricing and signature
// swatches stay in the initial client bundle without pulling the full library.

export interface SignatureColour {
  name: string;
  hex: string;
}

export const SIGNATURE_COLOURS: SignatureColour[] = [
  { name: "Bright White", hex: "#FBFBF9" },
  { name: "Ecru", hex: "#E8E1D3" },
  // Domain data, not UI ink: this literal is the customer-selectable True Black swatch.
  { name: "True Black", hex: "#111111" },
  { name: "Oat Milk", hex: "#DCD3C0" },
  { name: "Indian Almond", hex: "#C9A27E" },
  { name: "Cocoa Mocha", hex: "#5B4636" },
  { name: "Buffalo Chip", hex: "#8A7B6C" },
  { name: "Glacier Lake", hex: "#7FA6B3" },
  { name: "Silver Bullet", hex: "#B8B8B8" },
  { name: "Deep Periwinkle", hex: "#6E7FBF" },
  { name: "Amparo Blue", hex: "#3B5BA5" },
  { name: "Blue Ribbon", hex: "#1F4FCC" },
  { name: "Odyssey Gray", hex: "#4A4A48" },
  { name: "Polar Night", hex: "#0D0D12" },
];

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
