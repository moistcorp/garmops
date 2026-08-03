import * as pantoneTable from "pantone-table";

// Loaded only after the customer opens the Pantone browser. On-screen hex
// values are previews; final production colour is approved against a physical
// fabric/lab dip.

export interface PantoneColour {
  code: string; // e.g. "100 U", "7401 U"
  hex: string;
  /** Common colour-family names a buyer might search for instead of the
   *  Pantone code (e.g. "navy", "maroon"). Not shown in the UI — used for
   *  search matching only. */
  aliases: string[];
}

const CURATED_PANTONE_COLOURS: PantoneColour[] = [
  { code: "100 U", hex: "#F5E657", aliases: ["yellow", "lemon"] },
  { code: "101 U", hex: "#F5E13F", aliases: ["yellow", "canary"] },
  { code: "102 U", hex: "#F7E017", aliases: ["yellow", "sunshine"] },
  { code: "7401 U", hex: "#E9DDAF", aliases: ["sand", "beige", "cream"] },
  { code: "7402 U", hex: "#E4D69B", aliases: ["sand", "beige", "khaki"] },
  { code: "7403 U", hex: "#D9C46A", aliases: ["gold", "mustard"] },
  { code: "137 U", hex: "#F0A83A", aliases: ["orange", "amber"] },
  { code: "1585 U", hex: "#E2792B", aliases: ["orange", "rust", "burnt orange"] },
  { code: "179 U", hex: "#E0402A", aliases: ["red", "orange red", "tomato"] },
  { code: "1795 U", hex: "#C6122A", aliases: ["red", "crimson"] },
  { code: "202 U", hex: "#7C2529", aliases: ["maroon", "burgundy", "wine"] },
  { code: "2617 U", hex: "#5F2B78", aliases: ["purple", "violet", "plum"] },
  { code: "2725 U", hex: "#5147AD", aliases: ["purple", "violet", "indigo"] },
  { code: "286 U", hex: "#1C4CA6", aliases: ["navy", "royal blue", "cobalt", "blue"] },
  { code: "3145 U", hex: "#00767E", aliases: ["teal", "turquoise"] },
  { code: "3415 U", hex: "#00693C", aliases: ["green", "forest", "emerald"] },
  { code: "355 U", hex: "#189F4A", aliases: ["green", "kelly green"] },
  { code: "425 U", hex: "#565A5C", aliases: ["grey", "gray", "steel"] },
  { code: "431 U", hex: "#4B535A", aliases: ["grey", "gray", "slate"] },
  { code: "446 U", hex: "#3A3D3C", aliases: ["charcoal", "grey", "gray"] },
];

const curatedPantonesByCode = new Map(
  CURATED_PANTONE_COLOURS.map((colour) => [colour.code.toLowerCase(), colour])
);

function pantoneCodeFromKey(key: string): string {
  const value = key
    .slice("pantone_".length, -"_u".length)
    .replaceAll("_", " ");

  return `${value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase())} U`;
}

const uncoatedPantoneLibrary = Object.entries(pantoneTable)
  .filter(
    ([key, hex]) =>
      key.startsWith("pantone_") &&
      key.endsWith("_u") &&
      /^#[0-9a-f]{6}$/i.test(hex)
  )
  .map(([key, hex]) => {
    const code = pantoneCodeFromKey(key);
    return (
      curatedPantonesByCode.get(code.toLowerCase()) ?? {
        code,
        hex: hex.toUpperCase(),
        aliases: [],
      }
    );
  });

const libraryCodes = new Set(
  uncoatedPantoneLibrary.map((colour) => colour.code.toLowerCase())
);

// Curated entries retain buyer-friendly search aliases. Any curated reference
// absent from the imported Uncoated library remains selectable.
export const PANTONE_COLOURS: PantoneColour[] = [
  ...uncoatedPantoneLibrary,
  ...CURATED_PANTONE_COLOURS.filter(
    (colour) => !libraryCodes.has(colour.code.toLowerCase())
  ),
];
