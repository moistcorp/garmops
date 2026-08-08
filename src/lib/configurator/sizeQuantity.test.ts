import { describe, expect, it } from "vitest";
import {
  getSmallestOrderedSize,
  MAX_CONFIGURATION_QUANTITY,
  normalizeSizeQuantity,
  parseSizeQuantityInput,
} from "./sizeQuantity";

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
