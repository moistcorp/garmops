import {
  GST_PERCENT,
  RUSH_DELIVERY_FEE_PER_UNIT,
  getConfiguredUnitPrice,
  getVolumeDiscountAmount,
  getVolumeDiscountPercent,
} from "@/lib/configurator/pricing";
import { getProduct } from "@/lib/configurator/products";
import type { ProductId } from "@/lib/configurator/pricing";
import type { GarmentColour, Artwork, NeckLabel } from "@/lib/configurator/types/configurator";
import type { CartItem } from "./OrderReviewStep";
import type { Address } from "./AddressForm";
import type { Size } from "./SizeQuantityGrid";
import { SIZES } from "./SizeQuantityGrid";
import { scheduleUploadCleanup } from "@/lib/configurator/objectUrls";
import { RESERVATION_FEE } from "@/lib/configurator/reservation";

const STORAGE_PREFIX = "mf_configurator_cart:";
const ACTIVE_CART_KEY = `${STORAGE_PREFIX}active`;
const ACTIVE_CART_ID_KEY = `${STORAGE_PREFIX}active_id`;
export const CART_DRAFT_UPDATED_EVENT = "mf-cart-updated";


const SIZE_DISTRIBUTION: Record<(typeof SIZES)[number], number> = {
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
  gstin: "",
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
  receiveEmails: false,
};

function createEmptyAddress(): Address {
  return { ...emptyAddress };
}

export interface CartDraft {
  items: CartItem[];
  shippingAddress: Address;
  billingAddress: Address;
  sameAsShipping: boolean;
  selectedDeliveryDateIso?: string;
  orderConfirmedDateIso?: string;
  deliveryType?: "rush" | "standard" | "flexible";
  promoCode: string;
}

export function createCartItems(cartId: string): CartItem[] {
  // A missing cart is genuinely empty. Earlier versions seeded a demo item
  // here, which meant the first real configuration was silently charged
  // alongside an unrelated sample garment.
  void cartId;
  return [];
}

export function createDraft(cartId: string): CartDraft {
  return {
    items: createCartItems(cartId),
    shippingAddress: createEmptyAddress(),
    billingAddress: createEmptyAddress(),
    sameAsShipping: true,
    promoCode: "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeAddress(value: unknown): Address {
  if (!isRecord(value)) return createEmptyAddress();
  return {
    firstName: asString(value.firstName),
    lastName: asString(value.lastName),
    company: asOptionalString(value.company),
    gstin: asOptionalString(value.gstin),
    country: asString(value.country, "India"),
    addressLine1: asString(value.addressLine1),
    addressLine2: asOptionalString(value.addressLine2),
    zip: asString(value.zip),
    city: asString(value.city),
    state: asOptionalString(value.state),
    email: asString(value.email),
    phone: asString(value.phone),
    poNumber: asOptionalString(value.poNumber),
    orderNotes: asOptionalString(value.orderNotes),
    receiveEmails: value.receiveEmails === true,
  };
}

function normalizeQuantity(value: unknown): number {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
}

function normalizeSizeQuantities(
  value: unknown,
  productSizes: readonly string[]
): Record<Size, number> {
  const source = isRecord(value) ? value : {};
  if (productSizes.length === 1 && productSizes[0] === "One Size") {
    const explicit = normalizeQuantity(source["One Size"]);
    const migratedTotal =
      explicit ||
      Object.values(source).reduce<number>(
        (sum, quantity) => sum + normalizeQuantity(quantity),
        0
      );
    return { "One Size": migratedTotal };
  }

  return Object.fromEntries(
    productSizes.map((size) => [size, normalizeQuantity(source[size])])
  );
}

function normalizeCartItem(value: unknown): CartItem | null {
  if (!isRecord(value)) return null;
  const productId = asString(value.productId);
  const product = getProduct(productId);
  if (!product || !isRecord(value.colour) || !isRecord(value.artwork)) return null;

  const colourType = value.colour.type;
  const colourName = value.colour.name;
  const colourHex = value.colour.hex;
  if (
    (colourType !== "signature" && colourType !== "custom_dye") ||
    typeof colourName !== "string" ||
    typeof colourHex !== "string"
  ) {
    return null;
  }

  const colour: GarmentColour = {
    type: colourType,
    name: colourName,
    hex: colourHex,
    confirmed: value.colour.confirmed === true,
  };
  const artwork = value.artwork as Artwork;
  const neckLabel = isRecord(value.neckLabel)
    ? (value.neckLabel as unknown as NeckLabel)
    : undefined;
  const sizeQuantities = normalizeSizeQuantities(value.sizeQuantities, product.sizes);
  const rushDelivery = value.rushDelivery === true;

  let calculatedBasePrice: number;
  try {
    calculatedBasePrice = getConfiguredUnitPrice(
      productId,
      colour,
      artwork,
      neckLabel,
      rushDelivery
    );
  } catch {
    return null;
  }

  const storedBasePrice = Number(value.baseUnitPrice);
  const baseUnitPrice =
    Number.isFinite(storedBasePrice) && storedBasePrice >= 0
      ? storedBasePrice
      : calculatedBasePrice;
  const units = totalUnits(sizeQuantities);
  const unitPrice =
    baseUnitPrice - getVolumeDiscountAmount(baseUnitPrice, units);

  return {
    id: asString(value.id, `${productId}-${Date.now().toString(36)}`),
    productId,
    productName: asString(value.productName, product.name),
    previewImage: asString(value.previewImage, product.defaultImage),
    colour,
    artwork,
    neckLabel,
    sizeQuantities,
    baseUnitPrice,
    unitPrice,
    rushDelivery,
  };
}

function normalizeDraft(value: unknown, cartId: string): CartDraft {
  if (!isRecord(value)) return createDraft(cartId);
  const items = Array.isArray(value.items)
    ? value.items.map(normalizeCartItem).filter((item): item is CartItem => item !== null)
    : [];
  const deliveryType =
    value.deliveryType === "rush" ||
    value.deliveryType === "standard" ||
    value.deliveryType === "flexible"
      ? value.deliveryType
      : undefined;

  return {
    items,
    shippingAddress: normalizeAddress(value.shippingAddress),
    billingAddress: normalizeAddress(value.billingAddress),
    sameAsShipping: value.sameAsShipping !== false,
    selectedDeliveryDateIso: asOptionalString(value.selectedDeliveryDateIso),
    orderConfirmedDateIso: asOptionalString(value.orderConfirmedDateIso),
    deliveryType,
    promoCode: asString(value.promoCode),
  };
}

export function readDraft(cartId: string): CartDraft {
  if (typeof window === "undefined") return createDraft(cartId);

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${cartId}`);
    if (!raw) return createDraft(cartId);
    return normalizeDraft(JSON.parse(raw), cartId);
  } catch {
    return createDraft(cartId);
  }
}

export function writeDraft(cartId: string, draft: CartDraft): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(draft);
    window.localStorage.setItem(ACTIVE_CART_ID_KEY, cartId);
    window.localStorage.setItem(`${STORAGE_PREFIX}${cartId}`, serialized);
    // Keep the legacy mirror small. Older versions duplicated the entire
    // (potentially upload-heavy) draft under ACTIVE_CART_KEY.
    window.localStorage.removeItem(ACTIVE_CART_KEY);
    window.dispatchEvent(
      new CustomEvent(CART_DRAFT_UPDATED_EVENT, {
        detail: { cartId },
      })
    );
    scheduleUploadCleanup();
  } catch {
    // Storage can be unavailable or full. The caller's in-memory state should
    // remain usable even when persistence is not.
  }
}

export function readActiveCartSummary(): { cartId: string; itemCount: number } | null {
  if (typeof window === "undefined") return null;

  try {
    const cartId = window.localStorage.getItem(ACTIVE_CART_ID_KEY);
    if (!cartId) return null;
    const raw =
      window.localStorage.getItem(`${STORAGE_PREFIX}${cartId}`) ??
      window.localStorage.getItem(ACTIVE_CART_KEY);
    if (!raw) return null;
    const parsed = normalizeDraft(JSON.parse(raw), cartId);
    return { cartId, itemCount: parsed.items.length };
  } catch {
    return null;
  }
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

export interface UpsertConfiguredCartItemOptions {
  /** Explicit target used when editing an item from an existing cart. */
  cartId?: string;
  /** Existing item to replace. Omit when adding a new line item. */
  itemId?: string;
}

function readActiveCartId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_CART_ID_KEY);
  } catch {
    return null;
  }
}

export function splitQuantityAcrossSizes(
  quantity: number,
  sizes: readonly Size[] = SIZES
): Record<Size, number> {
  const safeQuantity =
    Number.isFinite(quantity) && quantity > 0 ? Math.max(1, Math.floor(quantity)) : 1;
  if (sizes.length === 0) return {};
  if (sizes.length === 1) {
    return { [sizes[0]]: safeQuantity };
  }

  const knownApparelSizes = sizes.every((size) =>
    (SIZES as readonly string[]).includes(size)
  );
  const entries = sizes.map((size) => {
    const weight = knownApparelSizes
      ? SIZE_DISTRIBUTION[size as (typeof SIZES)[number]]
      : 1 / sizes.length;
    const exact = safeQuantity * weight;
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
  suggestedCartId: string,
  input: ConfiguredCartItemInput,
  options: UpsertConfiguredCartItemOptions = {}
): string {
  const cartId = options.cartId ?? readActiveCartId() ?? suggestedCartId;
  const draft = readDraft(cartId);
  const product = getProduct(input.productId);
  const sizeQuantities = splitQuantityAcrossSizes(
    input.quantity,
    product?.sizes ?? SIZES
  );
  const baseUnitPrice = getConfiguredUnitPrice(
    input.productId,
    input.colour,
    input.artwork,
    input.neckLabel,
    input.rushDelivery
  );
  const unitDiscount = getVolumeDiscountAmount(baseUnitPrice, input.quantity);
  const unitPrice = baseUnitPrice - unitDiscount;

  const configuredItem: CartItem = {
    id:
      options.itemId ??
      `${input.productId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    productId: input.productId,
    productName: input.productName,
    previewImage: input.previewImage,
    colour: { ...input.colour, confirmed: true },
    artwork: input.artwork,
    neckLabel: input.neckLabel,
    sizeQuantities,
    baseUnitPrice,
    unitPrice,
    rushDelivery: input.rushDelivery,
  };

  const existingIndex = options.itemId
    ? draft.items.findIndex((item) => item.id === options.itemId)
    : -1;
  const items =
    existingIndex >= 0
      ? draft.items.map((item, index) =>
          index === existingIndex ? configuredItem : item
        )
      : [configuredItem, ...draft.items];

  writeDraft(cartId, { ...draft, items });
  return cartId;
}

export function totalUnits(sizeQuantities: Record<Size, number>): number {
  return Object.values(sizeQuantities).reduce(
    (sum, quantity) =>
      sum +
      (Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0),
    0
  );
}

export function itemSubtotal(item: CartItem): number {
  return totalUnits(item.sizeQuantities) * getCartItemUnitPrice(item);
}

export function getCartItemBaseUnitPrice(item: CartItem): number {
  return (
    item.baseUnitPrice ??
    getConfiguredUnitPrice(
      item.productId,
      item.colour,
      item.artwork,
      item.neckLabel,
      item.rushDelivery
    )
  );
}

export function getCartItemDiscountPercent(item: CartItem): number {
  return getVolumeDiscountPercent(totalUnits(item.sizeQuantities));
}

export function getCartItemUnitPrice(item: CartItem): number {
  const baseUnitPrice = getCartItemBaseUnitPrice(item);
  const unitDiscount = getVolumeDiscountAmount(baseUnitPrice, totalUnits(item.sizeQuantities));
  return baseUnitPrice - unitDiscount;
}

export function calculateTotals(
  items: CartItem[],
  deliveryType?: CartDraft["deliveryType"]
) {
  const garmentSubtotal = items.reduce(
    (sum, item) => sum + totalUnits(item.sizeQuantities) * getCartItemBaseUnitPrice(item),
    0
  );
  const totalQuantity = items.reduce((sum, item) => sum + totalUnits(item.sizeQuantities), 0);
  const volumeDiscount = items.reduce((sum, item) => {
    const itemUnits = totalUnits(item.sizeQuantities);
    const unitDiscount = getCartItemBaseUnitPrice(item) - getCartItemUnitPrice(item);
    return sum + unitDiscount * itemUnits;
  }, 0);
  // Units whose baseUnitPrice already has RUSH_DELIVERY_FEE_PER_UNIT baked in
  // (see pricing.ts's getUnitPriceAdjustments) must not be charged again here.
  const rushAlreadyPricedUnits = items.reduce(
    (sum, item) => sum + (item.rushDelivery ? totalUnits(item.sizeQuantities) : 0),
    0
  );
  const shippingFee =
    deliveryType === "rush"
      ? RUSH_DELIVERY_FEE_PER_UNIT * Math.max(0, totalQuantity - rushAlreadyPricedUnits)
      : 0;
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