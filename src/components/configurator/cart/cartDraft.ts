import {
  getConfiguredLinePricingPaise,
  getConfiguredUnitPrice,
  getVolumeDiscountPercent,
} from "@/lib/configurator/pricing";
import { getProduct, getProductMinimumOrderQuantity } from "@/lib/configurator/products";
import { RUSH_DELIVERY_SURCHARGE_PAISE } from "@/lib/configurator/delivery";
import { CUSTOM_DYE_MOQ_UNITS } from "@/lib/configurator/colourRules";
import { calculateTaxPaise } from "@/lib/tax";
import type { ProductId } from "@/lib/configurator/pricing";
import type { GarmentColour, Artwork, NeckLabel } from "@/lib/configurator/types/configurator";
import type { CartItem } from "./OrderReviewStep";
import type { Address } from "./AddressForm";
import type {
  BillingInformation,
  ProjectContact,
  ProjectPreferences,
  ShippingInformation,
} from "./checkoutDetails";
import type { Size } from "./SizeQuantityGrid";
import { SIZES } from "./SizeQuantityGrid";
import { scheduleUploadCleanup } from "@/lib/configurator/objectUrls";
import { MAX_CONFIGURATION_QUANTITY } from "@/lib/configurator/sizeQuantity";

const STORAGE_PREFIX = "mf_configurator_cart:";
const ACTIVE_CART_KEY = `${STORAGE_PREFIX}active`;
const ACTIVE_CART_ID_KEY = `${STORAGE_PREFIX}active_id`;
export const CART_DRAFT_UPDATED_EVENT = "mf-cart-updated";
export const MAX_CONFIGURED_CART_ITEMS = 20;

const SIZE_DISTRIBUTION: Record<(typeof SIZES)[number], number> = {
  XS: 0.1,
  S: 0.25,
  M: 0.3,
  L: 0.2,
  XL: 0.1,
  XXL: 0.05,
};

export const emptyAddress: Address = {
  country: "India",
  addressLine1: "",
  addressLine2: "",
  zip: "",
  city: "",
  state: "",
};

function createEmptyAddress(): Address {
  return { ...emptyAddress };
}

function createEmptyProjectContact(): ProjectContact {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    department: "",
  };
}

function createEmptyShipping(): ShippingInformation {
  return {
    recipientName: "",
    company: "",
    address: createEmptyAddress(),
    multipleLocations: false,
    multipleLocationsNotes: "",
  };
}

function createEmptyBilling(): BillingInformation {
  return {
    sameAsCompanyAddress: true,
    entity: "",
    address: createEmptyAddress(),
    accountsPayableEmail: "",
    gstin: "",
  };
}

function createEmptyPreferences(): ProjectPreferences {
  return {
    orderNotes: "",
    receiveEmails: false,
  };
}

export interface CartDraft {
  items: CartItem[];
  projectName: string;
  projectContact: ProjectContact;
  shippingInformation: ShippingInformation;
  billingInformation: BillingInformation;
  projectPreferences: ProjectPreferences;
  selectedDeliveryDateIso?: string;
  orderConfirmedDateIso?: string;
  deliveryType?: "rush" | "standard" | "flexible";
  promoCode: string;
}

export function createCartItems(cartId: string): CartItem[] {
  void cartId;
  return [];
}

export function createDraft(cartId: string): CartDraft {
  return {
    items: createCartItems(cartId),
    projectName: "",
    projectContact: createEmptyProjectContact(),
    shippingInformation: createEmptyShipping(),
    billingInformation: createEmptyBilling(),
    projectPreferences: createEmptyPreferences(),
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
    country: asString(value.country, "India"),
    addressLine1: asString(value.addressLine1),
    addressLine2: asOptionalString(value.addressLine2),
    zip: asString(value.zip),
    city: asString(value.city),
    state: asOptionalString(value.state),
  };
}

function normalizeProjectContact(value: unknown): ProjectContact {
  if (!isRecord(value)) return createEmptyProjectContact();
  const department = asString(value.department);
  const allowedDepartments = ["HR", "Operations", "Marketing", "Procurement", "Founder", "Other"];
  return {
    firstName: asString(value.firstName),
    lastName: asString(value.lastName),
    email: asString(value.email),
    phone: asString(value.phone),
    department: (allowedDepartments.includes(department) ? department : "") as ProjectContact["department"],
  };
}

function normalizeShipping(value: unknown): ShippingInformation {
  if (!isRecord(value)) return createEmptyShipping();
  return {
    recipientName: asString(value.recipientName),
    company: asString(value.company),
    address: normalizeAddress(value.address),
    multipleLocations: value.multipleLocations === true,
    multipleLocationsNotes: asString(value.multipleLocationsNotes),
  };
}

function normalizeBilling(value: unknown): BillingInformation {
  if (!isRecord(value)) return createEmptyBilling();
  return {
    sameAsCompanyAddress: value.sameAsCompanyAddress !== false,
    entity: asString(value.entity),
    address: normalizeAddress(value.address),
    accountsPayableEmail: asString(value.accountsPayableEmail),
    gstin: asString(value.gstin).toUpperCase(),
  };
}

function normalizePreferences(value: unknown): ProjectPreferences {
  if (!isRecord(value)) return createEmptyPreferences();
  return {
    orderNotes: asString(value.orderNotes),
    receiveEmails: value.receiveEmails === true,
  };
}

function legacyAddress(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function migrateLegacyProcurementDetails(value: Record<string, unknown>): Pick<
  CartDraft,
  "projectContact" | "shippingInformation" | "billingInformation" | "projectPreferences"
> {
  const shipping = legacyAddress(value.shippingAddress);
  const legacyBilling = legacyAddress(value.billingAddress);
  const sameAsShipping = value.sameAsShipping !== false;
  const shippingAddress = normalizeAddress(shipping);
  const billingAddress = sameAsShipping ? shippingAddress : normalizeAddress(legacyBilling);
  const firstName = asString(shipping.firstName);
  const lastName = asString(shipping.lastName);
  const billingName = asString(shipping.company);
  const contactEmail = asString(shipping.email);
  const legacyGstin = asString(shipping.gstin).toUpperCase();

  return {
    projectContact: {
      ...createEmptyProjectContact(),
      firstName,
      lastName,
      email: contactEmail,
      phone: asString(shipping.phone),
    },
    shippingInformation: {
      ...createEmptyShipping(),
      recipientName: `${firstName} ${lastName}`.trim(),
      company: billingName,
      address: shippingAddress,
    },
    billingInformation: {
      ...createEmptyBilling(),
      sameAsCompanyAddress: sameAsShipping,
      entity: asString(legacyBilling.company, billingName) || `${firstName} ${lastName}`.trim(),
      address: billingAddress,
      accountsPayableEmail: asString(legacyBilling.email, contactEmail),
      gstin: asString(legacyBilling.gstin, legacyGstin).toUpperCase(),
    },
    projectPreferences: {
      orderNotes: asString(shipping.orderNotes),
      receiveEmails: shipping.receiveEmails === true,
    },
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
    id: typeof value.colour.id === "string" ? value.colour.id : undefined,
    name: colourName,
    hex: colourHex,
    confirmed: value.colour.confirmed === true,
  };
  const artwork = value.artwork as Artwork;
  const neckLabel = isRecord(value.neckLabel)
    ? (value.neckLabel as unknown as NeckLabel)
    : undefined;
  const sizeQuantities = normalizeSizeQuantities(value.sizeQuantities, product.sizes);
  const plannedQuantity = normalizeQuantity(value.plannedQuantity) || undefined;
  const rushDelivery = value.rushDelivery === true;

  let calculatedBasePrice: number;
  try {
    calculatedBasePrice = getConfiguredUnitPrice(
      productId,
      colour,
      artwork,
      neckLabel,
      false
    );
  } catch {
    return null;
  }

  const units = totalUnits(sizeQuantities);
  const normalizedLinePricing = getConfiguredLinePricingPaise({
    productId,
    colour,
    artwork,
    neckLabel,
    quantity: units,
  });
  const baseUnitPrice = calculatedBasePrice;
  const unitPrice = normalizedLinePricing.discountedUnitPaise / 100;

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
    plannedQuantity,
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

  const hasStructuredDetails =
    isRecord(value.projectContact) ||
    isRecord(value.shippingInformation) ||
    isRecord(value.billingInformation);

  const procurement = hasStructuredDetails
    ? {
        projectContact: normalizeProjectContact(value.projectContact),
        shippingInformation: normalizeShipping(value.shippingInformation),
        billingInformation: normalizeBilling(value.billingInformation),
        projectPreferences: normalizePreferences(value.projectPreferences),
      }
    : migrateLegacyProcurementDetails(value);

  return {
    items,
    projectName: asString(value.projectName),
    ...procurement,
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

export function writeDraft(cartId: string, draft: CartDraft): boolean {
  if (typeof window === "undefined") return false;
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
    return true;
  } catch {
    // Storage can be unavailable or full. The caller's in-memory state should
    // remain usable even when persistence is not.
    return false;
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


export function clearPaidCart(cartId: string): void {
  if (typeof window === "undefined") return;

  try {
    const cartKey = `${STORAGE_PREFIX}${cartId}`;
    const raw = window.localStorage.getItem(cartKey);
    const itemIds: string[] = [];

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { items?: Array<{ id?: unknown }> };
        for (const item of parsed.items ?? []) {
          if (typeof item.id === "string") itemIds.push(item.id);
        }
      } catch {
        // The cart itself is still safe to remove when its JSON is corrupted.
      }
    }

    window.localStorage.removeItem(cartKey);
    window.localStorage.removeItem(`garmops:configurator-order:${cartId}`);

    // A customer may revisit an old paid-order result after starting a new cart.
    // Only clear the active-cart pointer when it still belongs to this paid cart.
    if (window.localStorage.getItem(ACTIVE_CART_ID_KEY) === cartId) {
      window.localStorage.removeItem(ACTIVE_CART_ID_KEY);
      window.localStorage.removeItem(ACTIVE_CART_KEY);
    }

    for (const itemId of itemIds) {
      const storageKey = `cart-item:${itemId}`;
      window.localStorage.removeItem(`mf_configurator_build:${storageKey}`);
      window.localStorage.removeItem(`mf_configurator_cloud:${storageKey}`);
      window.localStorage.removeItem(`mf_configurator_cloud_pending:checkout:${cartId}:${itemId}`);
    }

    window.dispatchEvent(
      new CustomEvent(CART_DRAFT_UPDATED_EVENT, { detail: { cartId, cleared: true } }),
    );
    scheduleUploadCleanup();
  } catch {
    // Payment and order finalisation are authoritative even if browser cleanup fails.
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
  /** Preserved when a cart line returns to Studio for design adjustments. */
  sizeQuantities?: Record<Size, number>;
  rushDelivery: boolean;
}

export interface UpsertConfiguredCartItemOptions {
  /** Explicit target used when editing an item from an existing cart. */
  cartId?: string;
  /** Existing item to replace. Omit when adding a new line item. */
  itemId?: string;
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
): string | null {
  const cartId = options.cartId ?? suggestedCartId;
  const draft = readDraft(cartId);
  const product = getProduct(input.productId);
  const minimumQuantity = getProductMinimumOrderQuantity(input.productId, {
    colourType: input.colour.type,
    customDyeMinimum: CUSTOM_DYE_MOQ_UNITS,
  });
  const requestedQuantity = Number.isFinite(input.quantity)
    ? Math.min(MAX_CONFIGURATION_QUANTITY, Math.max(0, Math.floor(input.quantity)))
    : 0;
  const quantity = options.itemId
    ? requestedQuantity
    : Math.max(minimumQuantity, requestedQuantity);
  const productSizes = product?.sizes ?? SIZES;
  const restoredSizeQuantities = input.sizeQuantities
    ? normalizeSizeQuantities(input.sizeQuantities, productSizes)
    : null;
  const isOneSize = productSizes.length === 1 && productSizes[0] === "One Size";
  const hasRestoredAllocation =
    restoredSizeQuantities && totalUnits(restoredSizeQuantities) === quantity;
  const sizeQuantities = hasRestoredAllocation
    ? restoredSizeQuantities
    : isOneSize
      ? { [productSizes[0]]: quantity }
      : Object.fromEntries(productSizes.map((size) => [size, 0]));
  const linePricing = getConfiguredLinePricingPaise({
    productId: input.productId,
    colour: input.colour,
    artwork: input.artwork,
    neckLabel: input.neckLabel,
    quantity,
  });
  const baseUnitPrice = linePricing.configuredUnitPaise / 100;
  const unitPrice = linePricing.discountedUnitPaise / 100;

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
    rushDelivery: false,
    plannedQuantity: hasRestoredAllocation || isOneSize ? undefined : quantity,
  };

  const existingIndex = options.itemId
    ? draft.items.findIndex((item) => item.id === options.itemId)
    : -1;
  const items = existingIndex >= 0
    ? draft.items.map((item, index) => index === existingIndex ? configuredItem : item)
    : [...draft.items, configuredItem];

  const saved = writeDraft(cartId, { ...draft, items });
  return saved ? cartId : null;
}

export function totalUnits(sizeQuantities: Record<Size, number>): number {
  return Object.values(sizeQuantities).reduce(
    (sum, quantity) =>
      sum +
      (Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0),
    0
  );
}

export function getCartItemBaseUnitPrice(item: CartItem): number {
  // Reprice from the saved configuration so the review screen uses the same
  // current catalogue rules as the server. Persisted display prices are not authoritative.
  return getConfiguredUnitPrice(
    item.productId,
    item.colour,
    item.artwork,
    item.neckLabel,
    false,
  );
}

export function getCartItemDiscountPercent(item: CartItem): number {
  return getVolumeDiscountPercent(totalUnits(item.sizeQuantities));
}

export function getCartItemUnitPrice(item: CartItem): number {
  return getConfiguredLinePricingPaise({
    productId: item.productId,
    colour: item.colour,
    artwork: item.artwork,
    neckLabel: item.neckLabel,
    quantity: totalUnits(item.sizeQuantities),
  }).discountedUnitPaise / 100;
}

export function calculateTotals(
  items: CartItem[],
  deliveryType?: CartDraft["deliveryType"],
) {
  const linePricing = items.map((item) => getConfiguredLinePricingPaise({
    productId: item.productId,
    colour: item.colour,
    artwork: item.artwork,
    neckLabel: item.neckLabel,
    quantity: totalUnits(item.sizeQuantities),
  }));
  const garmentSubtotalPaise = linePricing.reduce(
    (sum, line) => sum + line.merchandiseSubtotalPaise,
    0,
  );
  const volumeDiscountPaise = linePricing.reduce(
    (sum, line) => sum + line.volumeDiscountPaise,
    0,
  );
  const quantity = items.reduce(
    (sum, item) => sum + totalUnits(item.sizeQuantities),
    0,
  );
  const rushFeePaise =
    deliveryType === "rush" ? quantity * RUSH_DELIVERY_SURCHARGE_PAISE : 0;
  const merchandiseAfterVolumeDiscountPaise =
    garmentSubtotalPaise - volumeDiscountPaise;
  const taxableSubtotalPaise =
    merchandiseAfterVolumeDiscountPaise + rushFeePaise;
  const gstPaise = calculateTaxPaise(taxableSubtotalPaise);
  const totalPaise = taxableSubtotalPaise + gstPaise;

  return {
    subtotal: garmentSubtotalPaise / 100,
    subtotalPaise: garmentSubtotalPaise,
    volumeDiscount: volumeDiscountPaise / 100,
    volumeDiscountPaise,
    rushFee: rushFeePaise / 100,
    rushFeePaise,
    shippingFee: 0,
    hasRushDelivery: deliveryType === "rush",
    gst: gstPaise / 100,
    gstPaise,
    taxableSubtotal: taxableSubtotalPaise / 100,
    taxableSubtotalPaise,
    total: totalPaise / 100,
    totalPaise,
  };
}
