import {
  GST_PERCENT,
  getBasePrice,
  getConfiguredUnitPrice,
} from "@/lib/configurator/pricing";
import { getProduct } from "@/lib/configurator/products";
import type { ProductId } from "@/lib/configurator/pricing";
import type { GarmentColour, Artwork, NeckLabel } from "@/lib/configurator/types/configurator";
import type { CartItem } from "./OrderReviewStep";
import type { Address } from "./AddressForm";
import type { Size } from "./SizeQuantityGrid";
import { SIZES } from "./SizeQuantityGrid";

const STORAGE_PREFIX = "mf_configurator_cart:";

export const RESERVATION_FEE = 499;

const SIZE_DISTRIBUTION: Record<Size, number> = {
  XS: 0.1,
  S: 0.25,
  M: 0.3,
  L: 0.2,
  XL: 0.1,
  XXL: 0.05,
};

export const emptyAddress: Address = {
  firstName: "",
  lastName: "",
  company: "",
  country: "India",
  addressLine1: "",
  addressLine2: "",
  zip: "",
  city: "",
  state: "",
  email: "",
  phone: "",
  poNumber: "",
  orderNotes: "",
  receiveEmails: true,
};

export interface CartDraft {
  items: CartItem[];
  shippingAddress: Address;
  billingAddress: Address;
  sameAsShipping: boolean;
  selectedDeliveryDateIso?: string;
  deliveryType?: "rush" | "standard" | "flexible";
  promoCode: string;
}

export function createCartItems(cartId: string): CartItem[] {
  const product = getProduct(cartId);
  const productId = product?.id ?? "tshirt-classic";
  let unitPrice = 499;

  try {
    unitPrice = getBasePrice(productId);
  } catch {
    // Keep the cart usable for placeholder product IDs.
  }

  return [
    {
      id: "item-1",
      productId,
      productName: product?.name ?? "Classic T-Shirt",
      previewImage: product?.defaultImage ?? "/mock/tshirt-preview.png",
      colour: { type: "signature", name: "Jet Black", hex: "#111111", confirmed: true },
      artwork: {
        front: {
          fileUrl: "/mock/artwork-front.svg",
          fileType: "svg",
          vectorized: true,
          technique: "screen_print",
          width: 25,
          height: 30,
          fromNeck: 8,
          fromCenter: 0,
          printArea: "M",
          guidelines: { maximumArea: false, leftChest: false },
          confirmed: true,
        },
      },
      neckLabel: undefined,
      sizeQuantities: { XS: 5, S: 15, M: 20, L: 15, XL: 5, XXL: 0 },
      unitPrice,
      rushDelivery: false,
      artworkFees: [{ label: "Preparation - Front", unitPrice: 499, count: 1 }],
      applicationFees: [{ label: "Underbase", unitPrice: 299, count: 1 }],
    },
  ];
}

export function createDraft(cartId: string): CartDraft {
  return {
    items: createCartItems(cartId),
    shippingAddress: emptyAddress,
    billingAddress: emptyAddress,
    sameAsShipping: true,
    promoCode: "",
  };
}

export function readDraft(cartId: string): CartDraft {
  if (typeof window === "undefined") return createDraft(cartId);

  const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${cartId}`);
  if (!raw) return createDraft(cartId);

  try {
    return { ...createDraft(cartId), ...JSON.parse(raw) };
  } catch {
    return createDraft(cartId);
  }
}

export function writeDraft(cartId: string, draft: CartDraft): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${STORAGE_PREFIX}${cartId}`, JSON.stringify(draft));
}

export interface ConfiguredCartItemInput {
  productId: ProductId;
  productName: string;
  previewImage: string;
  colour: GarmentColour;
  artwork: Artwork;
  neckLabel?: NeckLabel;
  quantity: number;
  rushDelivery: boolean;
}

export function splitQuantityAcrossSizes(quantity: number): Record<Size, number> {
  const safeQuantity = Math.max(1, Math.floor(quantity));
  const entries = SIZES.map((size) => {
    const exact = safeQuantity * SIZE_DISTRIBUTION[size];
    return {
      size,
      qty: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });
  let allocated = entries.reduce((sum, entry) => sum + entry.qty, 0);

  [...entries]
    .sort((a, b) => b.remainder - a.remainder)
    .forEach((entry) => {
      if (allocated >= safeQuantity) return;
      entry.qty += 1;
      allocated += 1;
    });

  return entries.reduce(
    (acc, entry) => ({ ...acc, [entry.size]: entry.qty }),
    {} as Record<Size, number>
  );
}

export function upsertConfiguredCartItem(
  cartId: string,
  input: ConfiguredCartItemInput
): void {
  const draft = readDraft(cartId);
  const sizeQuantities = splitQuantityAcrossSizes(input.quantity);
  const unitPrice = getConfiguredUnitPrice(
    input.productId,
    input.colour,
    input.artwork,
    input.neckLabel,
    input.rushDelivery
  );

  const configuredItem: CartItem = {
    id: "item-1",
    productId: input.productId,
    productName: input.productName,
    previewImage: input.previewImage,
    colour: { ...input.colour, confirmed: true },
    artwork: input.artwork,
    neckLabel: input.neckLabel,
    sizeQuantities,
    unitPrice,
    rushDelivery: input.rushDelivery,
    artworkFees: [],
    applicationFees: [],
  };

  writeDraft(cartId, {
    ...draft,
    items: [configuredItem, ...draft.items.filter((item) => item.id !== configuredItem.id)],
  });
}

export function totalUnits(sizeQuantities: Record<Size, number>): number {
  return SIZES.reduce((sum, size) => sum + (sizeQuantities[size] || 0), 0);
}

export function itemSubtotal(item: CartItem): number {
  return totalUnits(item.sizeQuantities) * item.unitPrice;
}

export function calculateTotals(
  items: CartItem[],
  deliveryType?: CartDraft["deliveryType"]
) {
  const garmentSubtotal = items.reduce(
    (sum, item) => sum + totalUnits(item.sizeQuantities) * item.unitPrice,
    0
  );
  const totalQuantity = items.reduce((sum, item) => sum + totalUnits(item.sizeQuantities), 0);
  const volumeDiscount = 0;
  const shippingFee = 0;
  const hasRushDelivery =
    deliveryType === "rush" || items.some((item) => item.rushDelivery === true);
  const subtotal = garmentSubtotal;
  const taxableSubtotal = subtotal - volumeDiscount + shippingFee;
  const gst = (taxableSubtotal * GST_PERCENT) / 100;
  const total = taxableSubtotal + gst;

  return {
    subtotal,
    volumeDiscount,
    shippingFee,
    hasRushDelivery,
    gst,
    taxableSubtotal,
    total,
    balanceDue: Math.max(0, total - RESERVATION_FEE),
  };
}
