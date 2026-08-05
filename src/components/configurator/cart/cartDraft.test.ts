import { afterEach, describe, expect, it, vi } from "vitest";

import type { CartItem } from "./OrderReviewStep";
import { calculateTotals, clearPaidCart, readDraft, totalUnits, upsertConfiguredCartItem } from "./cartDraft";

function configuredItem(quantity = 50): CartItem {
  return {
    id: "item-1",
    productId: "regular-fit-tee-200gsm",
    productName: "Regular Fit Tee",
    previewImage: "/test.webp",
    colour: {
      type: "signature",
      name: "Bright White",
      hex: "#FFFFFF",
      confirmed: true,
    },
    artwork: {},
    sizeQuantities: {
      XS: 0,
      S: 0,
      M: quantity,
      L: 0,
      XL: 0,
      XXL: 0,
    },
    baseUnitPrice: 500,
    unitPrice: 500,
    rushDelivery: false,
  };
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("configurator cart totals", () => {
  it("adds the ₹75 per-unit rush surcharge before GST", () => {
    const items = [configuredItem(50)];
    const standard = calculateTotals(items, "standard");
    const rush = calculateTotals(items, "rush");

    expect(rush.rushFeePaise).toBe(50 * 7_500);
    expect(rush.taxableSubtotalPaise - standard.taxableSubtotalPaise).toBe(
      50 * 7_500,
    );
    expect(rush.gstPaise - standard.gstPaise).toBe(
      Math.round((50 * 7_500 * 5) / 100),
    );
  });
});


describe("multi-item cart lines", () => {
  it("keeps two identical products as independent MOQ-valid lines", () => {
    const localStorage = new MemoryStorage();
    vi.stubGlobal("window", {
      localStorage,
      dispatchEvent: vi.fn(),
      setTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
    });
    vi.stubGlobal(
      "CustomEvent",
      class {
        constructor(
          public readonly type: string,
          public readonly init?: unknown,
        ) {}
      },
    );

    const input = {
      productId: "regular-fit-tee-200gsm" as const,
      productName: "Regular Fit Tee",
      previewImage: "/test.webp",
      colour: {
        type: "signature" as const,
        name: "Bright White",
        hex: "#FFFFFF",
        confirmed: true,
      },
      artwork: {},
      quantity: 50,
      rushDelivery: false,
    };

    expect(upsertConfiguredCartItem("cart-1", input)).toBe("cart-1");
    expect(upsertConfiguredCartItem("cart-1", input, { cartId: "cart-1" })).toBe("cart-1");

    const draft = readDraft("cart-1");
    expect(draft.items).toHaveLength(2);
    expect(draft.items[0].id).not.toBe(draft.items[1].id);
    expect(draft.items.map((item) => totalUnits(item.sizeQuantities))).toEqual([50, 50]);
  });
});

describe("paid cart cleanup", () => {
  it("removes the paid cart and its prepared checkout state", () => {
    const localStorage = new MemoryStorage();
    localStorage.setItem(
      "mf_configurator_cart:paid-cart",
      JSON.stringify({ items: [{ id: "item-1" }] }),
    );
    localStorage.setItem("mf_configurator_cart:active_id", "paid-cart");
    localStorage.setItem("garmops:durable-order:paid-cart", "prepared");
    localStorage.setItem("mf_configurator_build:cart-item:item-1", "draft");

    vi.stubGlobal("window", {
      localStorage,
      dispatchEvent: vi.fn(),
      setTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
    });
    vi.stubGlobal(
      "CustomEvent",
      class {
        constructor(
          public readonly type: string,
          public readonly init?: unknown,
        ) {}
      },
    );

    clearPaidCart("paid-cart");

    expect(localStorage.getItem("mf_configurator_cart:paid-cart")).toBeNull();
    expect(localStorage.getItem("mf_configurator_cart:active_id")).toBeNull();
    expect(localStorage.getItem("garmops:durable-order:paid-cart")).toBeNull();
    expect(
      localStorage.getItem("mf_configurator_build:cart-item:item-1"),
    ).toBeNull();
  });

  it("does not clear a newer active cart when an old result page is revisited", () => {
    const localStorage = new MemoryStorage();
    localStorage.setItem(
      "mf_configurator_cart:paid-cart",
      JSON.stringify({ items: [] }),
    );
    localStorage.setItem("mf_configurator_cart:active_id", "new-cart");
    localStorage.setItem("mf_configurator_cart:new-cart", "new draft");

    vi.stubGlobal("window", {
      localStorage,
      dispatchEvent: vi.fn(),
      setTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
    });
    vi.stubGlobal(
      "CustomEvent",
      class {
        constructor(
          public readonly type: string,
          public readonly init?: unknown,
        ) {}
      },
    );

    clearPaidCart("paid-cart");

    expect(localStorage.getItem("mf_configurator_cart:active_id")).toBe(
      "new-cart",
    );
    expect(localStorage.getItem("mf_configurator_cart:new-cart")).toBe(
      "new draft",
    );
  });
});
