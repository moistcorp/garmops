import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addConfiguredLine,
  getCatalog,
  getServerPricing,
  prepareConfiguredCheckout,
  removeConfiguredLine,
  saveCheckoutDetails,
  updateConfiguredLine,
} from "./commerce";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Medusa commerce boundary", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => vi.restoreAllMocks());

  it("uses the active backend catalog and stable slugs", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({
      products: [{ slug: "regular-fit-tee-200gsm", minimumOrderQuantity: 75, basePriceRupees: 999 }],
      currencyCode: "inr",
      shippingPaise: 0,
    }));

    const result = await getCatalog();

    expect(result.products[0]).toMatchObject({
      slug: "regular-fit-tee-200gsm",
      minimumOrderQuantity: 75,
      basePriceRupees: 999,
    });
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("/api/medusa/store/garmops/catalog");
  });

  it("renders the server price even when it differs from the old local estimate", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({
      pricing: {
        configuredUnitPaise: 22500,
        discountedMerchandiseUnitPaise: 22500,
        unitPricePaise: 22500,
        subtotalPaise: 1125000,
        volumeDiscountPaise: 0,
        taxPaise: 56250,
        totalPaise: 1181250,
        discountPercent: 0,
        adjustments: [],
      },
    }));

    const pricing = await getServerPricing({ productSlug: "regular-fit-tee-200gsm", quantity: 50 });

    expect(pricing.unitPricePaise).toBe(22500);
    expect(pricing.totalPaise).toBe(1181250);
  });

  it("keeps add, update, and remove on the canonical Medusa line boundary", async () => {
    const cart = {
      cartId: "cart_123",
      cartType: "configured",
      lines: [{ id: "line_a", projectId: "design_a", versionId: "version_a", quantity: 50, sizeBreakdown: { M: 50 }, deliveryType: "standard", pricing: { unitPricePaise: 22500 } }],
      subtotalPaise: 1125000,
      discountPaise: 0,
      gstPaise: 56250,
      rushFeePaise: 0,
      shippingPaise: 0,
      grandTotalPaise: 1181250,
      validationProblems: [],
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({ line: { id: "line_a" }, pricing: cart.lines[0].pricing, cart }))
      .mockResolvedValueOnce(json({ line: { id: "line_a" }, pricing: cart.lines[0].pricing, cart }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const added = await addConfiguredLine({ cartId: "cart_123", projectId: "design_a", versionId: "version_a", quantity: 50, sizes: { M: 50 } });
    const updated = await updateConfiguredLine({ lineId: "line_a", quantity: 50, sizes: { L: 50 } });
    await removeConfiguredLine("line_a");

    expect(added.cart.lines[0]?.id).toBe("line_a");
    expect(updated.cart.lines[0]?.id).toBe("line_a");
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
      "/api/medusa/store/garmops/cart-lines",
      "/api/medusa/store/garmops/cart-lines/line_a",
      "/api/medusa/store/garmops/cart-lines/line_a",
    ]);
    const updateBody = JSON.parse(String((vi.mocked(fetch).mock.calls[1]?.[1] as RequestInit).body));
    expect(updateBody.versionId).toBeUndefined();
  });

  it("sends a newly saved design version when updating a configured line", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({ line: {}, pricing: {}, cart: {} }));
    await updateConfiguredLine({ lineId: "line_a", versionId: "version_b", quantity: 50, sizes: { M: 50 } });
    const body = JSON.parse(String((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body));
    expect(body.versionId).toBe("version_b");
  });

  it("persists shipping details through the Medusa checkout boundary", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({ cart: { cartId: "cart_123" } }));
    await saveCheckoutDetails({ cartId: "cart_123", email: "buyer@example.com", shippingAddress: { first_name: "Buyer" }, billingAddress: { first_name: "Buyer" }, requestedDeliveryDate: "2026-09-15", deliveryPreference: "standard" });
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("/api/medusa/store/garmops/checkout/details");
    const body = JSON.parse(String((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body));
    expect(body.cartId).toBe("cart_123");
    expect(body.requestedDeliveryDate).toBe("2026-09-15");
  });

  it("preserves independent Medusa IDs when the same product is configured twice", async () => {
    const line = (id: string, projectId: string) => ({
      id,
      projectId,
      versionId: `${projectId}_version`,
      quantity: 50,
      sizeBreakdown: { M: 50 },
      deliveryType: "standard",
      pricing: { unitPricePaise: 22500 },
    });
    const cart = (lines: ReturnType<typeof line>[]) => ({ cartId: "cart_123", cartType: "configured", lines, subtotalPaise: 2250000, discountPaise: 0, gstPaise: 112500, rushFeePaise: 0, shippingPaise: 0, grandTotalPaise: 2362500, validationProblems: [] });
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({ line: { id: "line_a" }, pricing: line("line_a", "design_a").pricing, cart: cart([line("line_a", "design_a")]) }))
      .mockResolvedValueOnce(json({ line: { id: "line_b" }, pricing: line("line_b", "design_b").pricing, cart: cart([line("line_a", "design_a"), line("line_b", "design_b")]) }));

    const first = await addConfiguredLine({ cartId: "cart_123", projectId: "design_a", versionId: "design_a_version", quantity: 50, sizes: { M: 50 } });
    const second = await addConfiguredLine({ cartId: "cart_123", projectId: "design_b", versionId: "design_b_version", quantity: 50, sizes: { M: 50 } });

    expect(first.cart.lines.map((item) => item.id)).toEqual(["line_a"]);
    expect(second.cart.lines.map((item) => item.id)).toEqual(["line_a", "line_b"]);
    expect(second.cart.lines[0]?.id).not.toBe(second.cart.lines[1]?.id);
  });

  it("surfaces a backend MOQ rejection instead of allowing payment to proceed", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({ code: "INVALID_CONFIGURED_LINE", message: "Order quantity must be at least 50" }, 400));

    await expect(addConfiguredLine({ cartId: "cart_123", projectId: "design_a", quantity: 10, sizes: { M: 10 } })).rejects.toMatchObject({
      status: 400,
      message: "Order quantity must be at least 50",
    });
  });

  it("prepares checkout with the existing cart and never sends a browser total", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({
      checkout: { cartId: "cart_123", amountPaise: 1181250, readyForPayment: true },
      cart: {},
    }));

    await prepareConfiguredCheckout({
      cartId: "cart_123",
      email: "buyer@example.com",
      shippingAddress: { first_name: "Buyer", address_1: "Address", city: "Bengaluru", province: "Karnataka", postal_code: "560001", country_code: "in" },
      billingAddress: { first_name: "Buyer", address_1: "Address", city: "Bengaluru", province: "Karnataka", postal_code: "560001", country_code: "in" },
      termsVersion: "2026-08-14",
    });

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1] && (vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body));
    expect(body.cartId).toBe("cart_123");
    expect(body.total).toBeUndefined();
    expect(body.amountPaise).toBeUndefined();
  });
});
