// TODO: placeholder hex values — replace with real Moist Corp signature swatch
// set before launch. Names are final per Appendix §4 Section A; hex values are
// approximations only.

export interface SignatureColour {
  name: string;
  hex: string;
}

export const SIGNATURE_COLOURS: SignatureColour[] = [
  { name: "Bright White", hex: "#F7F7F7" },
  { name: "Ecru", hex: "#E8E1D3" },
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

// TODO: placeholder codes/hex — small illustrative subset, not the full
// "thousands of unique references" Pantone TPG/U library described in
// Appendix §4 Section B. Replace with real reference data before launch.
export interface PantoneColour {
  code: string; // e.g. "100 U", "7401 U"
  hex: string;
}

export const PANTONE_COLOURS: PantoneColour[] = [
  { code: "100 U", hex: "#F5E657" },
  { code: "101 U", hex: "#F5E13F" },
  { code: "102 U", hex: "#F7E017" },
  { code: "7401 U", hex: "#E9DDAF" },
  { code: "7402 U", hex: "#E4D69B" },
  { code: "7403 U", hex: "#D9C46A" },
  { code: "137 U", hex: "#F0A83A" },
  { code: "1585 U", hex: "#E2792B" },
  { code: "179 U", hex: "#E0402A" },
  { code: "1795 U", hex: "#C6122A" },
  { code: "202 U", hex: "#7C2529" },
  { code: "2617 U", hex: "#5F2B78" },
  { code: "2725 U", hex: "#5147AD" },
  { code: "286 U", hex: "#1C4CA6" },
  { code: "3145 U", hex: "#00767E" },
  { code: "3415 U", hex: "#00693C" },
  { code: "355 U", hex: "#189F4A" },
  { code: "425 U", hex: "#565A5C" },
  { code: "431 U", hex: "#4B535A" },
  { code: "446 U", hex: "#3A3D3C" },
];