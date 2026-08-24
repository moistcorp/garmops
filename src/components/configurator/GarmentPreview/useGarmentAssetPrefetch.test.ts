import { describe, expect, it } from "vitest";
import { getInactiveGarmentViews } from "./useGarmentAssetPrefetch";

describe("garment asset prefetch order", () => {
  it.each([
    ["front", ["back", "neck"]],
    ["back", ["front", "neck"]],
    ["neck", ["front", "back"]],
  ] as const)("prefetches both inactive views after %s is ready", (activeView, expected) => {
    expect(getInactiveGarmentViews(activeView)).toEqual(expected);
  });
});
