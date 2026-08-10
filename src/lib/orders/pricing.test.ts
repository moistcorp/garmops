import { describe, expect, it } from "vitest";

import type { CloudDesignSnapshot } from "@/lib/designs/schema";
import { getConfiguredLinePricingPaise } from "@/lib/configurator/pricing";
import { calculateTaxPaise } from "@/lib/tax";

import { CONFIGURATOR_ORDER_PRICING_VERSION, priceConfiguratorOrder } from "./pricing";

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
    const result = priceConfiguratorOrder({
      snapshot: designSnapshot(),
      sizeQuantities: { XS: 5, S: 10, M: 15, L: 10, XL: 10 },
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
    ).toBe(CONFIGURATOR_ORDER_PRICING_VERSION);
  });


  it("uses the same integer-paise line pricing as the configurator", () => {
    const snapshot = designSnapshot(100);
    const server = priceConfiguratorOrder({
      snapshot,
      sizeQuantities: { XS: 10, S: 20, M: 30, L: 20, XL: 20 },
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
    const first = priceConfiguratorOrder({
      snapshot: designSnapshot(),
      sizeQuantities: { XS: 5, S: 10, M: 15, L: 10, XL: 10 },
      deliveryType: "standard",
      lineNumber: 1,
      cartItemId: "tee-line-a",
      designProjectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      designVersionId: "11111111-1111-4111-8111-111111111111",
    });
    const second = priceConfiguratorOrder({
      snapshot: designSnapshot(),
      sizeQuantities: { XS: 5, S: 10, M: 15, L: 10, XL: 10 },
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
    const standard = priceConfiguratorOrder({
      snapshot: designSnapshot(),
      sizeQuantities: { XS: 5, S: 10, M: 15, L: 10, XL: 10 },
      deliveryType: "standard",
    });
    const rush = priceConfiguratorOrder({
      snapshot: designSnapshot(),
      sizeQuantities: { XS: 5, S: 10, M: 15, L: 10, XL: 10 },
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
      priceConfiguratorOrder({
        snapshot: designSnapshot(),
      sizeQuantities: { XS: 5, S: 10, M: 14, L: 10, XL: 10 },
        deliveryType: "standard",
      }),
    ).toThrow("do not match");
  });

  it("enforces custom-dye minimum quantity on the server", () => {
    expect(() =>
      priceConfiguratorOrder({
        snapshot: designSnapshot(50, "custom_dye"),
      sizeQuantities: { XS: 5, S: 10, M: 15, L: 10, XL: 10 },
        deliveryType: "standard",
      }),
    ).toThrow("between 100");
  });

  it("enforces the product MOQ independently at the lower boundary", () => {
    expect(() => priceConfiguratorOrder({
      snapshot: designSnapshot(49),
      sizeQuantities: { XS: 0, S: 9, M: 20, L: 10, XL: 10 },
      deliveryType: "standard",
    })).toThrow("between 50");

    expect(priceConfiguratorOrder({
      snapshot: designSnapshot(50),
      sizeQuantities: { XS: 0, S: 10, M: 20, L: 10, XL: 10 },
      deliveryType: "standard",
    }).quantity).toBe(50);
  });

  it("rejects unavailable product sizes", () => {
    expect(() =>
      priceConfiguratorOrder({
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

  it("rejects artwork that does not fit the actual smallest ordered size", () => {
    const snapshot = designSnapshot();
    snapshot.configuration.artwork = {
      smallestSize: "M",
      front: {
        fileUrl: "https://assets.example.com/front.png",
        fileType: "png",
        vectorized: false,
        technique: "screen_print",
        width: 34,
        height: 8,
        fromNeck: 8,
        fromCenter: 0,
        printArea: "M",
        guidelines: { maximumArea: true, leftChest: false },
        confirmed: true,
      },
    };
    snapshot.configuration.steps[1] = {
      id: "artwork",
      title: "Artwork",
      summary: "Front · Screen Print",
      confirmed: true,
    };

    expect(() => priceConfiguratorOrder({
      snapshot,
      sizeQuantities: { XS: 0, S: 10, M: 20, L: 10, XL: 10 },
      deliveryType: "standard",
    })).toThrow("smallest ordered garment size");
  });
});
