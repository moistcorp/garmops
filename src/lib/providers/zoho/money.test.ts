import { describe, expect, it } from "vitest";

import {
  grossPaiseToExclusiveRatePaise,
  paiseToZohoAmount,
  utcTimestampToIndiaDate,
  zohoAmountToPaise,
} from "./money";

describe("Zoho money and accounting date helpers", () => {
  it("formats authoritative integer paise with two-decimal provider precision", () => {
    expect(paiseToZohoAmount(49_900)).toBe(499);
    expect(paiseToZohoAmount(49_999)).toBe(499.99);
  });

  it("rejects unsafe or fractional paise", () => {
    expect(() => paiseToZohoAmount(1.5)).toThrow(/invalid paise/i);
    expect(() => paiseToZohoAmount(-1)).toThrow(/invalid paise/i);
  });

  it("parses Zoho decimal amounts without floating-point multiplication", () => {
    expect(zohoAmountToPaise("499")).toBe(49_900);
    expect(zohoAmountToPaise("499.9")).toBe(49_990);
    expect(zohoAmountToPaise("499.99")).toBe(49_999);
  });

  it("rejects provider amounts with unsupported precision", () => {
    expect(() => zohoAmountToPaise("499.999")).toThrow(/invalid Zoho amount/i);
    expect(() => zohoAmountToPaise("-1")).toThrow(/invalid Zoho amount/i);
  });

  it("derives an exclusive pre-tax rate from a fixed gross payment using integer basis points", () => {
    expect(grossPaiseToExclusiveRatePaise(49_900, 1_800)).toBe(42_288);
    expect(grossPaiseToExclusiveRatePaise(49_900, 0)).toBe(49_900);
    expect(() => grossPaiseToExclusiveRatePaise(49_900, -1)).toThrow(/basis points/i);
  });

  it("uses the verified payment instant in Asia/Kolkata for the document date", () => {
    expect(utcTimestampToIndiaDate("2026-07-28T19:12:35Z")).toBe("2026-07-29");
    expect(utcTimestampToIndiaDate("2026-07-28T18:29:59Z")).toBe("2026-07-28");
  });
});
