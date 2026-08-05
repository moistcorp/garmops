import { describe, expect, it } from "vitest";

import type { CloudDesignSnapshot } from "@/lib/designs/schema";

import { CUSTOM_ORDER_PRICING_VERSION, priceCustomOrder } from "./pricing";

function designSnapshot(
  quantity = 50,
  colourType: "signature" | "custom_dye" = "signature",
): CloudDesignSnapshot {
  return {
    schemaVersion: 1,
    kind: "configurator_build",
    configId: "regular-fit-tee-200gsm",
    savedAt: "2026-07-29T12:00:00.000Z",
    configuration: {
      colour: {
        type: colourType,
        name: colourType === "signature" ? "Bright White" : "286 U",
        hex: "#FFFFFF",
        confirmed: true,
      },
      artwork: {},
      steps: [
        {
          id: "garment-colour",
          title: "Garment colour",
          summary: "Confirmed",
          confirmed: true,
        },
        {
          id: "artwork",
          title: "Artwork",
          summary: null,
          confirmed: false,
          skipped: true,
        },
        {
          id: "neck-label",
          title: "Neck label",
          summary: null,
          confirmed: false,
          skipped: true,
        },
      ],
      quantity,
    },
  };
}

describe("server custom-order pricing", () => {
  it("recalculates canonical paise totals from the saved design", () => {
    const result = priceCustomOrder({
      snapshot: designSnapshot(),
      sizeQuantities: { XS: 5, S: 10, M: 15, L: 10, XL: 5, XXL: 5 },
      deliveryType: "standard",
    });

    expect(result.quantity).toBe(50);
    expect(result.subtotalPaise).toBeGreaterThan(0);
    expect(result.taxEstimatePaise).toBe(
      Math.round((result.subtotalPaise * 5) / 100),
    );
    expect(result.estimatedTotalPaise).toBe(
      result.subtotalPaise + result.taxEstimatePaise,
    );
    expect(
      (result.item as { product_snapshot: { pricingVersion: string } })
        .product_snapshot.pricingVersion,
    ).toBe(CUSTOM_ORDER_PRICING_VERSION);
  });


  it("adds the rush surcharge after volume discount and before GST", () => {
    const standard = priceCustomOrder({
      snapshot: designSnapshot(),
      sizeQuantities: { XS: 5, S: 10, M: 15, L: 10, XL: 5, XXL: 5 },
      deliveryType: "standard",
    });
    const rush = priceCustomOrder({
      snapshot: designSnapshot(),
      sizeQuantities: { XS: 5, S: 10, M: 15, L: 10, XL: 5, XXL: 5 },
      deliveryType: "rush",
    });

    expect(rush.subtotalPaise - standard.subtotalPaise).toBe(50 * 7_500);
    expect(
      (rush.item as { product_snapshot: { rushSurchargePaise: number } })
        .product_snapshot.rushSurchargePaise,
    ).toBe(50 * 7_500);
  });

  it("rejects quantity tampering against the immutable design", () => {
    expect(() =>
      priceCustomOrder({
        snapshot: designSnapshot(),
        sizeQuantities: { XS: 5, S: 10, M: 14, L: 10, XL: 5, XXL: 5 },
        deliveryType: "standard",
      }),
    ).toThrow("do not match");
  });

  it("enforces custom-dye minimum quantity on the server", () => {
    expect(() =>
      priceCustomOrder({
        snapshot: designSnapshot(50, "custom_dye"),
        sizeQuantities: { XS: 5, S: 10, M: 15, L: 10, XL: 5, XXL: 5 },
        deliveryType: "standard",
      }),
    ).toThrow("between 100");
  });

  it("rejects unavailable product sizes", () => {
    expect(() =>
      priceCustomOrder({
        snapshot: designSnapshot(),
        sizeQuantities: {
          XS: 5,
          S: 10,
          M: 15,
          L: 10,
          XL: 5,
          XXXL: 5,
        },
        deliveryType: "standard",
      }),
    ).toThrow("unavailable size");
  });
});
