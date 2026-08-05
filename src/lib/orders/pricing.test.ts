import { describe, expect, it } from "vitest";

import type { CloudDesignSnapshot } from "@/lib/designs/schema";
import { getConfiguredLinePricingPaise } from "@/lib/configurator/pricing";
import { calculateTaxPaise } from "@/lib/tax";

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
      calculateTaxPaise(result.subtotalPaise),
    );
    expect(result.estimatedTotalPaise).toBe(
      result.subtotalPaise + result.taxEstimatePaise,
    );
    expect(
      (result.item as { product_snapshot: { pricingVersion: string } })
        .product_snapshot.pricingVersion,
    ).toBe(CUSTOM_ORDER_PRICING_VERSION);
  });


  it("uses the same integer-paise line pricing as the configurator", () => {
    const snapshot = designSnapshot(100);
    const server = priceCustomOrder({
      snapshot,
      sizeQuantities: { XS: 10, S: 20, M: 30, L: 20, XL: 10, XXL: 10 },
      deliveryType: "rush",
    });
    const browserLine = getConfiguredLinePricingPaise({
      productId: snapshot.configId,
      colour: snapshot.configuration.colour,
      artwork: {},
      neckLabel: undefined,
      quantity: 100,
    });
    const expectedSubtotal = browserLine.discountedSubtotalPaise + 100 * 7_500;
    expect(server.subtotalPaise).toBe(expectedSubtotal);
    expect(server.unitPricePaise * server.quantity).toBe(expectedSubtotal);
    expect(server.taxEstimatePaise).toBe(calculateTaxPaise(expectedSubtotal));
  });


  it("keeps duplicate products as separately numbered commercial lines", () => {
    const first = priceCustomOrder({
      snapshot: designSnapshot(),
      sizeQuantities: { XS: 5, S: 10, M: 15, L: 10, XL: 5, XXL: 5 },
      deliveryType: "standard",
      lineNumber: 1,
      cartItemId: "tee-line-a",
      designProjectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      designVersionId: "11111111-1111-4111-8111-111111111111",
    });
    const second = priceCustomOrder({
      snapshot: designSnapshot(),
      sizeQuantities: { XS: 5, S: 10, M: 15, L: 10, XL: 5, XXL: 5 },
      deliveryType: "standard",
      lineNumber: 2,
      cartItemId: "tee-line-b",
      designProjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      designVersionId: "22222222-2222-4222-8222-222222222222",
    });

    const firstItem = first.item as {
      line_number: number;
      product_snapshot: { cartItemId: string; minimumOrderQuantity: number };
    };
    const secondItem = second.item as {
      line_number: number;
      product_snapshot: { cartItemId: string; minimumOrderQuantity: number };
    };
    expect(firstItem.line_number).toBe(1);
    expect(secondItem.line_number).toBe(2);
    expect(firstItem.product_snapshot.cartItemId).toBe("tee-line-a");
    expect(secondItem.product_snapshot.cartItemId).toBe("tee-line-b");
    expect(firstItem.product_snapshot.minimumOrderQuantity).toBe(50);
    expect(secondItem.product_snapshot.minimumOrderQuantity).toBe(50);
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
