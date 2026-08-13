export const REFLECTIVE_COLOUR_OPTIONS = [
  { key: "silver", label: "Silver", hex: "#9B9EA1" },
  { key: "gold", label: "Gold", hex: "#9C7B43" },
  { key: "red", label: "Red", hex: "#D0021B" },
  { key: "neon_pink", label: "Neon Pink", hex: "#FF35A4" },
  { key: "neon_yellow", label: "Neon Yellow", hex: "#E9F000" },
  { key: "white", label: "White", hex: "#F7F7F5" },
  { key: "black", label: "Black", hex: "#111111" },
  { key: "royal_blue", label: "Royal Blue", hex: "#245B91" },
  { key: "green", label: "Green", hex: "#398A68" },
] as const;

export type ReflectiveColourKey = (typeof REFLECTIVE_COLOUR_OPTIONS)[number]["key"];

export const DEFAULT_REFLECTIVE_COLOUR: ReflectiveColourKey = "silver";

const REFLECTIVE_COLOUR_KEYS = new Set<string>(
  REFLECTIVE_COLOUR_OPTIONS.map((option) => option.key),
);

export function isReflectiveColourKey(value: unknown): value is ReflectiveColourKey {
  return typeof value === "string" && REFLECTIVE_COLOUR_KEYS.has(value);
}

export function getReflectiveColour(key?: ReflectiveColourKey) {
  return (
    REFLECTIVE_COLOUR_OPTIONS.find((option) => option.key === key) ??
    REFLECTIVE_COLOUR_OPTIONS[0]
  );
}
