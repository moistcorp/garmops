import { afterEach, describe, expect, it, vi } from "vitest";

import type { CartItem } from "./OrderReviewStep";
import { calculateTaxPaise } from "@/lib/tax";
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
      calculateTaxPaise(50 * 7_500),
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
      sizeQuantities: { XS: 10, S: 10, M: 10, L: 10, XL: 10 },
      rushDelivery: false,
    };

    expect(upsertConfiguredCartItem("cart-1", input)).toBe("cart-1");
    expect(upsertConfiguredCartItem("cart-1", input, { cartId: "cart-1" })).toBe("cart-1");

    const draft = readDraft("cart-1");
    expect(draft.items).toHaveLength(2);
    expect(draft.items[0].id).not.toBe(draft.items[1].id);
    expect(draft.items.map((item) => totalUnits(item.sizeQuantities))).toEqual([50, 50]);
    expect(draft.items.map((item) => item.plannedQuantity)).toEqual([undefined, undefined]);

    expect(upsertConfiguredCartItem("cart-1", {
      ...input,
      sizeQuantities: undefined,
    }, { cartId: "cart-1" })).toBe("cart-1");
    const unallocatedLine = readDraft("cart-1").items[2];
    expect(totalUnits(unallocatedLine.sizeQuantities)).toBe(0);
    expect(unallocatedLine.plannedQuantity).toBe(50);
  });

  it("preserves an edited line's size allocation when its total is unchanged", () => {
    const localStorage = new MemoryStorage();
    vi.stubGlobal("window", {
      localStorage,
      dispatchEvent: vi.fn(),
      setTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
    });
    vi.stubGlobal("CustomEvent", class {
      constructor(public readonly type: string, public readonly init?: unknown) {}
    });

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
      quantity: 30,
      sizeQuantities: { XS: 0, S: 10, M: 10, L: 10, XL: 0 },
      rushDelivery: false,
    };

    expect(upsertConfiguredCartItem("cart-1", input, { itemId: "line-1" })).toBe("cart-1");
    expect(readDraft("cart-1").items[0].sizeQuantities).toEqual(input.sizeQuantities);
  });

  it("stores a tote as one quantity without an apparel size split", () => {
    const localStorage = new MemoryStorage();
    vi.stubGlobal("window", {
      localStorage,
      dispatchEvent: vi.fn(),
      setTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
    });
    vi.stubGlobal("CustomEvent", class {
      constructor(public readonly type: string, public readonly init?: unknown) {}
    });

    expect(upsertConfiguredCartItem("tote-cart", {
      productId: "canvas-tote-bag",
      productName: "Canvas Tote Bag",
      previewImage: "/test.webp",
      colour: {
        type: "signature",
        name: "Natural",
        hex: "#F2E8D5",
        confirmed: true,
      },
      artwork: {},
      quantity: 100,
      rushDelivery: false,
    })).toBe("tote-cart");

    expect(readDraft("tote-cart").items[0].sizeQuantities).toEqual({
      "One Size": 100,
    });
  });

  it("keeps different products and their allocations independent", () => {
    const localStorage = new MemoryStorage();
    vi.stubGlobal("window", {
      localStorage,
      dispatchEvent: vi.fn(),
      setTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
    });
    vi.stubGlobal("CustomEvent", class {
      constructor(public readonly type: string, public readonly init?: unknown) {}
    });

    const colour = {
      type: "signature" as const,
      name: "Bright White",
      hex: "#FFFFFF",
      confirmed: true,
    };
    expect(upsertConfiguredCartItem("mixed-cart", {
      productId: "regular-fit-tee-200gsm",
      productName: "Regular Fit Tee",
      previewImage: "/tee.webp",
      colour,
      artwork: {},
      quantity: 50,
      sizeQuantities: { XS: 0, S: 10, M: 20, L: 15, XL: 5 },
      rushDelivery: false,
    })).toBe("mixed-cart");
    expect(upsertConfiguredCartItem("mixed-cart", {
      productId: "canvas-tote-bag",
      productName: "Canvas Tote Bag",
      previewImage: "/tote.webp",
      colour,
      artwork: {},
      quantity: 100,
      rushDelivery: false,
    }, { cartId: "mixed-cart" })).toBe("mixed-cart");

    const [tee, tote] = readDraft("mixed-cart").items;
    expect(tee.sizeQuantities).toEqual({ XS: 0, S: 10, M: 20, L: 15, XL: 5 });
    expect(tote.sizeQuantities).toEqual({ "One Size": 100 });
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
