import { describe, expect, it } from "vitest";

import type { CartItem } from "@/components/configurator/cart/OrderReviewStep";
import { flatlayAssetPath } from "@/lib/publicAssets";
import { buildCheckoutDraftForItem } from "./client";

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
