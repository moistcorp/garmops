import { describe, expect, it } from "vitest";

import {
  CUSTOMER_PRINT_TECHNIQUES,
  getCatalogueBasePriceRupees,
} from "@/lib/pricingRules";
import { getConfiguredPricingSummary } from "./pricing";

describe("canonical custom-order pricing", () => {
  it("uses product slugs for the catalogue starting price", () => {
    expect(getCatalogueBasePriceRupees("regular-fit-tee-200gsm")).toBe(535);
  });

  it("discounts merchandise before adding the taxable rush surcharge", () => {
    const standard = getConfiguredPricingSummary(
      "regular-fit-tee-200gsm",
      undefined,
      {},
      undefined,
      100,
      false,
    );
    const rush = getConfiguredPricingSummary(
      "regular-fit-tee-200gsm",
      undefined,
      {},
      undefined,
      100,
      true,
    );

    expect(rush.taxableSubtotal - standard.taxableSubtotal).toBe(7_500);
    expect(rush.gst - standard.gst).toBe(375);
    expect(rush.total - standard.total).toBe(7_875);
  });

  it("limits new customer selections to the three supported print techniques", () => {
    expect(CUSTOMER_PRINT_TECHNIQUES).toEqual([
      "screen_print",
      "dtf",
      "reflective_heat_transfer",
    ]);
  });
});
