import { CUSTOM_DYE_MOQ_UNITS } from "../configurator/colourRules";
import {
  getConfiguredLinePricingPaise,
  getConfiguredUnitPricePaise,
} from "../configurator/pricing";
import { getProduct, getProductMinimumOrderQuantity } from "../configurator/products";
import { RUSH_DELIVERY_SURCHARGE_PAISE } from "../configurator/delivery";
import { calculateTaxPaise, GST_RATE_BASIS_POINTS } from "@/lib/tax";
import type { Json } from "@/types/database.generated";

import type { CloudDesignSnapshot } from "@/lib/designs/schema";
import { hsnCodeForProduct } from "@/lib/invoices/hsn";
import type {
  Artwork,
  ArtworkSide,
  NeckLabel,
} from "../configurator/types/configurator";
import { isCustomerArtworkTechnique } from "../configurator/types/configurator";

export const CUSTOM_ORDER_PRICING_VERSION =
  "custom-configurator-v3-2026-08-05-multi-item";

type PricedCustomOrder = {
  productId: string;
  productName: string;
  quantity: number;
  sizeQuantities: Record<string, number>;
  unitPricePaise: number;
  subtotalPaise: number;
  shippingPaise: number;
  taxEstimatePaise: number;
  estimatedTotalPaise: number;
  item: Json;
  fileIds: string[];
};

function uniqueFileIds(snapshot: CloudDesignSnapshot): string[] {
  const values = [
    snapshot.configuration.artwork.front?.fileId,
    snapshot.configuration.artwork.back?.fileId,
    snapshot.configuration.neckLabel?.fileId,
  ].filter((value): value is string => Boolean(value));

  return [...new Set(values)];
}

function ensureCompleteConfiguration(snapshot: CloudDesignSnapshot): void {
  const { configuration } = snapshot;
  if (!configuration.colour.confirmed) {
    throw new Error("Garment colour must be confirmed");
  }
  if (
    configuration.steps.some(
      (step) => !step.confirmed && step.skipped !== true,
    )
  ) {
    throw new Error("Every configuration step must be completed");
  }
  for (const side of [
    configuration.artwork.front,
    configuration.artwork.back,
  ]) {
    if (side?.pendingUpload || (side && !side.confirmed)) {
      throw new Error("Artwork must be uploaded and confirmed");
    }
  }
  for (const side of [configuration.artwork.front, configuration.artwork.back]) {
    if (side?.technique && !isCustomerArtworkTechnique(side.technique)) {
      throw new Error("This saved design needs an updated production technique before it can be ordered");
    }
  }
  if (
    configuration.neckLabel?.pendingUpload ||
    (configuration.neckLabel && !configuration.neckLabel.confirmed)
  ) {
    throw new Error("Neck label must be uploaded and confirmed");
  }
}

export function priceCustomOrder(input: {
  snapshot: CloudDesignSnapshot;
  sizeQuantities: Record<string, number>;
  deliveryType: "rush" | "standard" | "flexible";
  lineNumber?: number;
  cartItemId?: string;
  designProjectId?: string;
  designVersionId?: string;
}): PricedCustomOrder {
  ensureCompleteConfiguration(input.snapshot);

  const product = getProduct(input.snapshot.configId);
  if (!product) throw new Error("Design product is no longer available");

  const entries = Object.entries(input.sizeQuantities);
  if (
    entries.some(
      ([size, quantity]) =>
        !product.sizes.includes(size) ||
        !Number.isInteger(quantity) ||
        quantity < 0,
    )
  ) {
    throw new Error("Size allocation contains an unavailable size");
  }
  if (
    product.sizes.some(
      (size) => !Object.hasOwn(input.sizeQuantities, size),
    )
  ) {
    throw new Error("Size allocation must include every available size");
  }

  const quantity = entries.reduce((total, [, value]) => total + value, 0);
  if (quantity !== input.snapshot.configuration.quantity) {
    throw new Error("Size quantities do not match the saved design quantity");
  }
  const minimum = getProductMinimumOrderQuantity(product.id, {
    colourType: input.snapshot.configuration.colour.type,
    customDyeMinimum: CUSTOM_DYE_MOQ_UNITS,
  });
  if (quantity < minimum || quantity > 1_000_000) {
    throw new Error(`Order quantity must be between ${minimum} and 1000000`);
  }

  const { configuration } = input.snapshot;
  const priceableArtwork = Object.fromEntries(
    (["front", "back"] as const)
      .map((side) => {
        const value = configuration.artwork[side];
        if (!value) return null;
        return [
          side,
          {
            ...value,
            fileUrl:
              value.fileUrl ??
              (value.fileId ? `private-file:${value.fileId}` : ""),
          } satisfies ArtworkSide,
        ] as const;
      })
      .filter(
        (
          entry,
        ): entry is readonly ["front" | "back", ArtworkSide] =>
          entry !== null,
      ),
  ) as Artwork;
  const priceableNeckLabel = configuration.neckLabel
    ? ({
        ...configuration.neckLabel,
        fileUrl:
          configuration.neckLabel.fileUrl ??
          (configuration.neckLabel.fileId
            ? `private-file:${configuration.neckLabel.fileId}`
            : ""),
      } satisfies NeckLabel)
    : undefined;
  const linePricing = getConfiguredLinePricingPaise({
    productId: product.id,
    colour: configuration.colour,
    artwork: priceableArtwork,
    neckLabel: priceableNeckLabel,
    quantity,
  });
  const configuredUnitPaise = linePricing.configuredUnitPaise;
  const discountPercent = linePricing.discountPercent;
  const discountedMerchandiseUnitPaise = linePricing.discountedUnitPaise;
  const volumeDiscountUnitPaise = linePricing.volumeDiscountUnitPaise;
  const rushSurchargeUnitPaise =
    input.deliveryType === "rush" ? RUSH_DELIVERY_SURCHARGE_PAISE : 0;
  const unitPricePaise =
    discountedMerchandiseUnitPaise + rushSurchargeUnitPaise;
  const volumeDiscountPaise = volumeDiscountUnitPaise * quantity;
  const rushSurchargePaise = rushSurchargeUnitPaise * quantity;
  const subtotalPaise = unitPricePaise * quantity;
  // Shipping is quoted and collected separately by staff after the order is reviewed.
  const shippingPaise = 0;
  const taxEstimatePaise = calculateTaxPaise(subtotalPaise);
  const estimatedTotalPaise = subtotalPaise + taxEstimatePaise;

  const productSnapshot = {
    id: product.id,
    slug: product.id,
    name: product.name,
    category: product.category,
    gsm: product.gsm,
    fit: product.fit,
    fabricFeel: product.fabricFeel,
    sizes: product.sizes,
    basePricePaise: getConfiguredUnitPricePaise(
      product.id,
      undefined,
      {},
      undefined,
    ),
    configuredUnitPaise,
    discountedMerchandiseUnitPaise,
    discountPercent,
    volumeDiscountUnitPaise,
    volumeDiscountPaise,
    deliveryType: input.deliveryType,
    rushSurchargeUnitPaise,
    rushSurchargePaise,
    pricingVersion: CUSTOM_ORDER_PRICING_VERSION,
    hsnCode: hsnCodeForProduct(product.id),
    gstRateBasisPoints: GST_RATE_BASIS_POINTS,
    cartItemId: input.cartItemId ?? null,
    designProjectId: input.designProjectId ?? null,
    designVersionId: input.designVersionId ?? null,
    minimumOrderQuantity: minimum,
  };

  const item = {
    line_number: input.lineNumber ?? 1,
    product_id: product.id,
    product_slug: product.id,
    product_name: product.name,
    product_snapshot: productSnapshot,
    colour_snapshot: configuration.colour,
    decoration_snapshot: {
      frontTechnique: configuration.artwork.front?.technique ?? null,
      backTechnique: configuration.artwork.back?.technique ?? null,
    },
    artwork_snapshot: configuration.artwork,
    neck_label_snapshot: configuration.neckLabel ?? null,
    size_breakdown: input.sizeQuantities,
    quantity,
    unit_price_paise: unitPricePaise,
    line_total_paise: subtotalPaise,
  } satisfies Json;

  return {
    productId: product.id,
    productName: product.name,
    quantity,
    sizeQuantities: input.sizeQuantities,
    unitPricePaise,
    subtotalPaise,
    shippingPaise,
    taxEstimatePaise,
    estimatedTotalPaise,
    item,
    fileIds: uniqueFileIds(input.snapshot),
  };
}
