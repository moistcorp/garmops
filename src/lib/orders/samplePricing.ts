import { products } from "@/lib/products";
import { hsnCodeForProduct } from "@/lib/invoices/hsn";
import type { Json } from "@/types/database.generated";

import type { SampleOrderItemInput } from "./sampleSchema";

export const SAMPLE_ORDER_PRICING_VERSION = "catalogue-samples-2026-01";
export const SAMPLE_ORDER_SCHEMA_VERSION = 1;
export const SAMPLE_FREE_SHIPPING_THRESHOLD_PAISE = 0;
export const SAMPLE_STANDARD_SHIPPING_PAISE = 0;
export const MAX_SAMPLE_LINES = 50;
export const MAX_SAMPLE_QUANTITY_PER_LINE = 100;

export type PricedSampleOrder = Readonly<{
  subtotalPaise: number;
  shippingPaise: number;
  taxEstimatePaise: number;
  estimatedTotalPaise: number;
  quantity: number;
  items: readonly Json[];
}>;

function unitPricePaise(priceRupees: number): number {
  if (!Number.isSafeInteger(priceRupees) || priceRupees <= 0) {
    throw new Error("Sample product has an invalid canonical price");
  }
  return priceRupees * 100;
}

export function priceSampleOrder(
  requestedItems: readonly SampleOrderItemInput[],
): PricedSampleOrder {
  if (!requestedItems.length || requestedItems.length > MAX_SAMPLE_LINES) {
    throw new Error("Sample order must contain between 1 and 50 items");
  }

  const merged = new Map<string, SampleOrderItemInput>();
  for (const requested of requestedItems) {
    const product = products.find((candidate) => candidate.id === requested.productId);
    if (!product || !product.sizes.includes(requested.size)) {
      throw new Error("A sample product or size is unavailable");
    }
    if (
      !Number.isInteger(requested.quantity) ||
      requested.quantity < 1 ||
      requested.quantity > MAX_SAMPLE_QUANTITY_PER_LINE
    ) {
      throw new Error("Sample quantity must be between 1 and 100 per size");
    }

    const key = `${requested.productId}:${requested.size}`;
    const current = merged.get(key);
    const quantity = (current?.quantity ?? 0) + requested.quantity;
    if (quantity > MAX_SAMPLE_QUANTITY_PER_LINE) {
      throw new Error("Combined sample quantity exceeds the per-size limit");
    }
    merged.set(key, { ...requested, quantity });
  }

  const canonicalItems = [...merged.values()];
  if (canonicalItems.length > MAX_SAMPLE_LINES) {
    throw new Error("Sample order contains too many distinct product sizes");
  }

  let subtotalPaise = 0;
  let quantity = 0;
  const items = canonicalItems.map((requested, index) => {
    const product = products.find((candidate) => candidate.id === requested.productId);
    if (!product) throw new Error("Sample product is unavailable");

    const pricePaise = unitPricePaise(product.price);
    const lineTotalPaise = pricePaise * requested.quantity;
    if (!Number.isSafeInteger(lineTotalPaise)) {
      throw new Error("Sample line total is too large");
    }
    subtotalPaise += lineTotalPaise;
    quantity += requested.quantity;

    return {
      line_number: index + 1,
      product_id: String(product.id),
      product_slug: product.slug,
      product_name: product.name,
      product_snapshot: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        pricingKey: product.pricingKey,
        category: product.category,
        gsm: product.gsm,
        fits: product.fits ?? [],
        details: product.details,
        careInstructions: product.careInstructions,
        image: product.image,
        samplePricePaise: pricePaise,
        pricingVersion: SAMPLE_ORDER_PRICING_VERSION,
        hsnCode: hsnCodeForProduct(product.slug),
        gstRateBasisPoints: 500,
      },
      colour_snapshot: {},
      decoration_snapshot: {},
      artwork_snapshot: {},
      neck_label_snapshot: null,
      size_breakdown: { [requested.size]: requested.quantity },
      quantity: requested.quantity,
      unit_price_paise: pricePaise,
      line_total_paise: lineTotalPaise,
    } satisfies Json;
  });

  if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise <= 0) {
    throw new Error("Sample subtotal is invalid");
  }

  const shippingPaise = 0;
  const taxEstimatePaise = Math.round(subtotalPaise * 0.05);
  const estimatedTotalPaise = subtotalPaise + taxEstimatePaise;

  return Object.freeze({
    subtotalPaise,
    shippingPaise,
    taxEstimatePaise,
    estimatedTotalPaise,
    quantity,
    items: Object.freeze(items),
  });
}
