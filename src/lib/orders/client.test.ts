import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CartItem } from "@/components/configurator/cart/OrderReviewStep";
import { flatlayAssetPath } from "@/lib/publicAssets";
import {
  buildCheckoutDraftForItem,
  isActivePaymentAttemptError,
  retryAfterFailedPaymentAttempt,
} from "./client";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function cartItem(neckLabel?: CartItem["neckLabel"]): CartItem {
  return {
    id: "cart-item-1",
    productId: "regular-fit-tee-200gsm",
    productName: "Classic T-Shirt",
    previewImage: flatlayAssetPath("regulartee.png"),
    colour: {
      type: "signature",
      id: "jet-black",
      name: "Jet Black",
      hex: "#161616",
      confirmed: true,
    },
    artwork: {},
    neckLabel,
    sizeQuantities: { XS: 0, S: 0, M: 50, L: 0, XL: 0, XXL: 0 },
    unitPrice: 535,
  };
}

describe("checkout design snapshots", () => {
  it("confirms the standard label choice before freezing the checkout design", () => {
    const draft = buildCheckoutDraftForItem(cartItem({
      labelType: "standard-size",
      fileUrl: "",
      dimensions: "50x18",
      position: "below_neck_tape",
      confirmed: false,
    }));

    expect(draft.neckLabel).toMatchObject({
      labelType: "standard-size",
      confirmed: true,
    });
    expect(draft.steps.find((step) => step.id === "neck-label")).toMatchObject({
      confirmed: true,
      summary: "Standard size label",
    });
  });
});

describe("payment attempt recovery", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => vi.restoreAllMocks());

  it("recognizes the active payment lock returned by the checkout backend", () => {
    expect(isActivePaymentAttemptError(new Error("Cart is locked while a payment attempt is active"))).toBe(true);
    expect(isActivePaymentAttemptError(new Error("Order quantity is invalid"))).toBe(false);
  });

  it("retries the cart operation only after PayU confirms failure", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("Cart is locked while a payment attempt is active"))
      .mockResolvedValueOnce("cart-ready");
    vi.mocked(fetch).mockResolvedValueOnce(json({ outcome: "failure" }));

    await expect(retryAfterFailedPaymentAttempt("cart_123", operation)).resolves.toBe("cart-ready");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body))).toEqual({ cartId: "cart_123" });
  });

  it("does not retry a cart while the previous payment is pending", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("Cart is locked while a payment attempt is active"));
    vi.mocked(fetch).mockResolvedValueOnce(json({ outcome: "pending" }, 202));

    await expect(retryAfterFailedPaymentAttempt("cart_123", operation)).rejects.toThrow("still being verified");
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
