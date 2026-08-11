import { describe, expect, it } from "vitest";
import {
  getRecommendedSizeAllocation,
  getSmallestOrderedSize,
  MAX_CONFIGURATION_QUANTITY,
  normalizeSizeQuantity,
  parseSizeQuantityInput,
} from "./sizeQuantity";

describe("recommended size allocation", () => {
  it.each([
    [["XS", "S", "M", "L", "XL", "XXL"], 50, [3, 8, 14, 14, 8, 3]],
    [["XS", "S", "M", "L", "XL", "XXL"], 100, [6, 16, 28, 28, 16, 6]],
    [["XS", "S", "M", "L", "XL", "XXL"], 200, [12, 32, 56, 56, 32, 12]],
    [["XS", "S", "M", "L", "XL"], 50, [5, 11, 18, 11, 5]],
    [["S", "M", "L"], 51, [13, 25, 13]],
  ] as const)("allocates %j pieces across %j", (sizes, target, expected) => {
    const allocation = getRecommendedSizeAllocation(sizes, target);

    expect(Object.values(allocation)).toEqual(expected);
    expect(Object.values(allocation).reduce((sum, quantity) => sum + quantity, 0)).toBe(target);
    expect(Object.values(allocation).every((quantity) => Number.isInteger(quantity) && quantity >= 0)).toBe(true);
  });

  it("handles one, two, and uncommon size counts", () => {
    expect(getRecommendedSizeAllocation(["One Size"], 50)).toEqual({ "One Size": 50 });
    expect(getRecommendedSizeAllocation(["Small", "Large"], 50)).toEqual({ Small: 25, Large: 25 });

    const allocation = getRecommendedSizeAllocation(["1", "2", "3", "4", "5", "6", "7"], 73);
    expect(Object.values(allocation).reduce((sum, quantity) => sum + quantity, 0)).toBe(73);
    expect(Object.values(allocation).every((quantity) => Number.isInteger(quantity) && quantity >= 0)).toBe(true);
    expect(allocation["4"]).toBeGreaterThan(allocation["1"]);
    expect(allocation["4"]).toBeGreaterThan(allocation["7"]);
  });
});

describe("size quantity input", () => {
  it("accepts whole-number keyboard and pasted input", () => {
    expect(parseSizeQuantityInput("250", 0)).toBe(250);
    expect(parseSizeQuantityInput(" 250 ", 0)).toBe(250);
  });

  it("rejects negative, decimal, scientific, and non-numeric input", () => {
    expect(parseSizeQuantityInput("-1", 12)).toBe(12);
    expect(parseSizeQuantityInput("1.5", 12)).toBe(12);
    expect(parseSizeQuantityInput("5e3", 12)).toBe(12);
    expect(parseSizeQuantityInput("NaN", 12)).toBe(12);
  });

  it("treats an empty field as zero and clamps huge values", () => {
    expect(parseSizeQuantityInput("", 12)).toBe(0);
    expect(parseSizeQuantityInput("999999999", 12)).toBe(
      MAX_CONFIGURATION_QUANTITY,
    );
    expect(normalizeSizeQuantity(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("smallest ordered size", () => {
  it("ignores zero quantities and follows garment size order", () => {
    expect(getSmallestOrderedSize({ XS: 0, S: 10, M: 20 })).toBe("S");
    expect(getSmallestOrderedSize({ XL: 4, M: 2, S: 0 })).toBe("M");
  });

  it("does not treat one-size products as apparel print-area sizes", () => {
    expect(getSmallestOrderedSize({ "One Size": 50 })).toBeUndefined();
  });
});
