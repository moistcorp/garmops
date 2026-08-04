import { describe, expect, it } from "vitest";

import {
  SAMPLE_FREE_SHIPPING_THRESHOLD_PAISE,
  SAMPLE_ORDER_PRICING_VERSION,
  SAMPLE_STANDARD_SHIPPING_PAISE,
  priceSampleOrder,
} from "./samplePricing";

describe("durable sample-order pricing", () => {
  it("prices catalogue items with 5% GST and excludes shipping", () => {
    const result = priceSampleOrder([
      { productId: 1, size: "M", quantity: 2 },
      { productId: 7, size: "One Size", quantity: 1 },
    ]);

    expect(result.subtotalPaise).toBe(142_000);
    expect(result.shippingPaise).toBe(SAMPLE_STANDARD_SHIPPING_PAISE);
    expect(result.taxEstimatePaise).toBe(7_100);
    expect(result.estimatedTotalPaise).toBe(149_100);
    expect(result.quantity).toBe(3);
    expect(result.items).toHaveLength(2);
    expect(
      (result.items[0] as { product_snapshot: { pricingVersion: string } })
        .product_snapshot.pricingVersion,
    ).toBe(SAMPLE_ORDER_PRICING_VERSION);
  });

  it("merges duplicate product-size lines before snapshotting", () => {
    const result = priceSampleOrder([
      { productId: 1, size: "L", quantity: 1 },
      { productId: 1, size: "L", quantity: 2 },
    ]);

    expect(result.items).toHaveLength(1);
    expect(result.quantity).toBe(3);
    expect(
      (result.items[0] as { size_breakdown: Record<string, number> })
        .size_breakdown,
    ).toEqual({ L: 3 });
  });

  it("always leaves shipping for the separate staff-issued payment link", () => {
    const result = priceSampleOrder([
      { productId: 1, size: "M", quantity: 4 },
    ]);

    expect(result.subtotalPaise).toBeGreaterThanOrEqual(
      SAMPLE_FREE_SHIPPING_THRESHOLD_PAISE,
    );
    expect(result.shippingPaise).toBe(0);
  });

  it("rejects unavailable sizes and quantity tampering", () => {
    expect(() =>
      priceSampleOrder([{ productId: 7, size: "M", quantity: 1 }]),
    ).toThrow("unavailable");
    expect(() =>
      priceSampleOrder([{ productId: 1, size: "M", quantity: 101 }]),
    ).toThrow("between 1 and 100");
  });
});
