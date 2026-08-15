"use client";

import { MedusaApiError } from "./types";

export type CatalogProduct = {
  slug: string;
  name: string;
  technicalName: string;
  category: string;
  selectorCategory: string;
  fit?: string;
  fabricFeel: string;
  material: string;
  description: string;
  gsm: number;
  sizes: string[];
  minimumOrderQuantity: number;
  basePriceRupees: number;
  image: string | null;
  details: string[];
  careInstructions: string[];
  metadata?: Record<string, unknown>;
};

export type PricingSnapshot = {
  pricingVersion: string;
  baseUnitPaise: number;
  configuredUnitPaise: number;
  discountedMerchandiseUnitPaise: number;
  discountPercent: number;
  volumeDiscountPaise: number;
  rushSurchargeUnitPaise: number;
  rushSurchargePaise: number;
  unitPricePaise: number;
  quantity: number;
  subtotalPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  gstRateBasisPoints: number;
  adjustments: Array<{ label: string; amountPaise?: number; percent?: number }>;
};

export type ConfiguredCartLine = {
  id: string;
  lineItemId?: string;
  product?: { slug?: string; name?: string };
  projectId: string;
  versionId: string;
  quantity: number;
  sizeBreakdown: Record<string, number>;
  deliveryType: "rush" | "standard" | "flexible";
  pricing: PricingSnapshot;
};

export type ConfiguredCartSummary = {
  cartId: string;
  cartType: "configured" | "sample";
  lines: ConfiguredCartLine[];
  subtotalPaise: number;
  discountPaise: number;
  gstPaise: number;
  rushFeePaise: number;
  shippingPaise: number;
  grandTotalPaise: number;
  validationProblems: string[];
};

type CatalogResponse = {
  products: CatalogProduct[];
  currencyCode: string;
  shippingPaise: number;
};

type CartResponse = { cart: ConfiguredCartSummary };

async function request<T>(path: string, init: Omit<RequestInit, "body"> & { body?: unknown } = {}): Promise<T> {
  const { body: requestBody, ...requestInit } = init;
  const response = await fetch(`/api/medusa${path}`, {
    ...requestInit,
    headers: {
      accept: "application/json",
      ...(requestBody === undefined ? {} : { "content-type": "application/json" }),
      ...init.headers,
    },
    body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
    cache: "no-store",
  });
  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorBody = responseBody && typeof responseBody === "object" ? responseBody as Record<string, unknown> : {};
    throw new MedusaApiError(response.status, errorBody);
  }
  return responseBody as T;
}

export function getCatalog(): Promise<CatalogResponse> {
  return request<CatalogResponse>("/store/garmops/catalog");
}

export function getConfiguredCart(cartId: string): Promise<ConfiguredCartSummary> {
  return request<CartResponse>(`/store/garmops/cart/${encodeURIComponent(cartId)}`).then((body) => body.cart);
}

export function resolveConfiguredCart(input?: { cartId?: string; email?: string }): Promise<ConfiguredCartSummary> {
  return request<CartResponse>("/store/garmops/cart", {
    method: "POST",
    body: { cartType: "configured", ...input },
  }).then((body) => body.cart);
}

export function getServerPricing(input: {
  productSlug: string;
  quantity: number;
  colourType?: "signature" | "custom_dye";
  artwork?: unknown;
  neckLabel?: unknown;
  deliveryType?: "rush" | "standard" | "flexible";
}): Promise<PricingSnapshot> {
  return request<{ pricing: PricingSnapshot }>("/store/garmops/pricing", {
    method: "POST",
    body: input,
  }).then((body) => body.pricing);
}

export function addConfiguredLine(input: {
  cartId: string;
  projectId: string;
  versionId?: string;
  quantity: number;
  sizes: Record<string, number>;
  deliveryType?: "rush" | "standard" | "flexible";
  configuration?: Record<string, unknown>;
}): Promise<{ line: Record<string, unknown>; pricing: PricingSnapshot; cart: ConfiguredCartSummary }> {
  return request("/store/garmops/cart-lines", { method: "POST", body: input });
}

export function updateConfiguredLine(input: {
  lineId: string;
  versionId?: string;
  quantity: number;
  sizes: Record<string, number>;
  deliveryType?: "rush" | "standard" | "flexible";
  configuration?: Record<string, unknown>;
}): Promise<{ line: Record<string, unknown>; pricing: PricingSnapshot; cart: ConfiguredCartSummary }> {
  return request(`/store/garmops/cart-lines/${encodeURIComponent(input.lineId)}`, {
    method: "PATCH",
    body: {
      versionId: input.versionId,
      quantity: input.quantity,
      sizes: input.sizes,
      deliveryType: input.deliveryType,
      configuration: input.configuration,
    },
  });
}

export function removeConfiguredLine(lineId: string): Promise<void> {
  return request(`/store/garmops/cart-lines/${encodeURIComponent(lineId)}`, { method: "DELETE" }).then(() => undefined);
}

export function prepareConfiguredCheckout(input: {
  cartId: string;
  email: string;
  projectName?: string;
  orderNotes?: string;
  gstin?: string;
  billingEntity?: string;
  shippingAddress: Record<string, unknown>;
  billingAddress: Record<string, unknown>;
  termsVersion: string;
  privacyVersion?: string;
  requestedDeliveryDate?: string;
  deliveryPreference?: string;
}): Promise<{ checkout: { cartId: string; amountPaise: number; readyForPayment: boolean }; cart: ConfiguredCartSummary }> {
  return request("/store/garmops/checkout/prepare", { method: "POST", body: input });
}

export function saveCheckoutDetails(input: {
  cartId: string;
  email: string;
  shippingAddress: Record<string, unknown>;
  billingAddress: Record<string, unknown>;
  billingEntity?: string;
  gstin?: string;
  requestedDeliveryDate?: string;
  deliveryPreference?: string;
}): Promise<{ cart: ConfiguredCartSummary }> {
  return request("/store/garmops/checkout/details", { method: "POST", body: input });
}
