import { describe, expect, it } from "vitest";
import {
  DEFAULT_REFLECTIVE_COLOUR,
  getReflectiveColour,
  isReflectiveColourKey,
  REFLECTIVE_COLOUR_OPTIONS,
} from "./reflectiveColours";

describe("reflective preview colours", () => {
  it("provides the controlled nine-colour range", () => {
    expect(REFLECTIVE_COLOUR_OPTIONS).toHaveLength(9);
    expect(REFLECTIVE_COLOUR_OPTIONS.map(({ key, hex }) => [key, hex])).toEqual([
      ["silver", "#9B9EA1"],
      ["gold", "#9C7B43"],
      ["red", "#D0021B"],
      ["neon_pink", "#FF35A4"],
      ["neon_yellow", "#E9F000"],
      ["white", "#F7F7F5"],
      ["black", "#111111"],
      ["royal_blue", "#245B91"],
      ["green", "#398A68"],
    ]);
  });

  it("defaults safely to silver and rejects unknown values", () => {
    expect(DEFAULT_REFLECTIVE_COLOUR).toBe("silver");
    expect(getReflectiveColour().key).toBe("silver");
    expect(isReflectiveColourKey("royal_blue")).toBe(true);
    expect(isReflectiveColourKey("purple")).toBe(false);
  });
});
