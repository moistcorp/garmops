// src/lib/configurator/pricing.ts

import {
  BACK_ARTWORK_UNIT_INCREASE_PERCENT,
  CUSTOMER_PRINT_TECHNIQUE_LABELS,
  CUSTOMER_PRINT_TECHNIQUE_UNIT_DELTAS,
  CUSTOM_DYE_UNIT_INCREASE_PERCENT,
  EXPRESS_DELIVERY_FEE_PER_UNIT,
  GST_PERCENT,
  NECK_LABEL_UNIT_PRICE,
  RUSH_DELIVERY_FEE_PER_UNIT,
  VOLUME_DISCOUNT_TIERS,
  getCatalogueBasePriceRupees,
  getVolumeDiscountAmount,
  getVolumeDiscountPercent,
  type VolumeDiscountTier,
} from "../pricingRules";
import { calculateTaxPaise } from "@/lib/tax";
import type { Artwork, ArtworkTechnique, GarmentColour, NeckLabel } from "./types/configurator";

// ============================================================
// PHASE 1 (confirmed) — base price lookup
// ============================================================

export type ProductId = string;

export function getBasePrice(productId: ProductId): number {
  return getCatalogueBasePriceRupees(productId);
}

export {
  BACK_ARTWORK_UNIT_INCREASE_PERCENT,
  CUSTOM_DYE_UNIT_INCREASE_PERCENT,
  EXPRESS_DELIVERY_FEE_PER_UNIT,
  GST_PERCENT,
  NECK_LABEL_UNIT_PRICE,
  RUSH_DELIVERY_FEE_PER_UNIT,
  VOLUME_DISCOUNT_TIERS,
  getVolumeDiscountAmount,
  getVolumeDiscountPercent,
  type VolumeDiscountTier,
};

/**
 * Legacy values are retained only so old saved design snapshots can be read.
 * They are never offered in the customer UI and cannot be submitted as a new
 * order. Historical orders retain their immutable pricing snapshots.
 */
const LEGACY_TECHNIQUE_UNIT_PRICE_DELTAS = {
  dtg: 28,
  puff_print: 52,
  embroidery: 65,
} as const;

export const TECHNIQUE_UNIT_PRICE_DELTAS = CUSTOMER_PRINT_TECHNIQUE_UNIT_DELTAS;

function techniqueUnitPriceDelta(technique: ArtworkTechnique): number {
  return CUSTOMER_PRINT_TECHNIQUE_UNIT_DELTAS[
    technique as keyof typeof CUSTOMER_PRINT_TECHNIQUE_UNIT_DELTAS
  ] ?? LEGACY_TECHNIQUE_UNIT_PRICE_DELTAS[
    technique as keyof typeof LEGACY_TECHNIQUE_UNIT_PRICE_DELTAS
  ];
}

/** A private cloud upload is still an artwork asset even when no URL is present. */
export function hasArtworkAsset(side?: Partial<Pick<import("./types/configurator").ArtworkSide, "fileUrl" | "fileId">>): boolean {
  return Boolean(side?.fileUrl || side?.fileId);
}

export function hasNeckLabelAsset(label?: Partial<Pick<NeckLabel, "fileUrl" | "fileId">>): boolean {
  return Boolean(label?.fileUrl || label?.fileId);
}

export type UnitPriceAdjustment = {
  label: string;
  percent?: number;
  amount?: number;
};

export function getUnitPriceAdjustments(
  colour?: Pick<GarmentColour, "type">,
  artwork: Artwork = {},
  neckLabel?: Partial<NeckLabel>,
  rushDelivery = false
): UnitPriceAdjustment[] {
  const adjustments: UnitPriceAdjustment[] = [];
  if (colour?.type === "custom_dye") {
    adjustments.push({ label: "Custom dye", percent: CUSTOM_DYE_UNIT_INCREASE_PERCENT });
  }

  (["front", "back"] as const).forEach((side) => {
    const artworkSide = artwork[side];
    if (!artworkSide || !hasArtworkAsset(artworkSide) || !artworkSide.technique) return;
    adjustments.push({
      label: `${side === "front" ? "Front" : "Back"} ${CUSTOMER_PRINT_TECHNIQUE_LABELS[
        artworkSide.technique as keyof typeof CUSTOMER_PRINT_TECHNIQUE_LABELS
      ] ?? "legacy decoration"}`,
      amount: techniqueUnitPriceDelta(artworkSide.technique),
    });
  });

  if (hasArtworkAsset(artwork.back)) {
    adjustments.push({ label: "Back artwork", percent: BACK_ARTWORK_UNIT_INCREASE_PERCENT });
  }

  if (hasNeckLabelAsset(neckLabel)) {
    adjustments.push({ label: "Neck label", amount: NECK_LABEL_UNIT_PRICE });
  }

  if (rushDelivery) {
    adjustments.push({ label: "Rush delivery", amount: RUSH_DELIVERY_FEE_PER_UNIT });
  }

  return adjustments;
}

export function applyUnitPriceAdjustments(
  basePrice: number,
  adjustments: UnitPriceAdjustment[]
): number {
  return adjustments.reduce((price, adjustment) => {
    if (adjustment.percent !== undefined) {
      return price * (1 + adjustment.percent / 100);
    }
    return price + (adjustment.amount ?? 0);
  }, basePrice);
}

export function getConfiguredUnitPrice(
  productId: ProductId,
  colour?: Pick<GarmentColour, "type">,
  artwork: Artwork = {},
  neckLabel?: Partial<NeckLabel>,
  rushDelivery = false
): number {
  return applyUnitPriceAdjustments(
    getBasePrice(productId),
    getUnitPriceAdjustments(colour, artwork, neckLabel, rushDelivery)
  );
}

export type ConfiguredLinePricingPaise = {
  configuredUnitPaise: number;
  discountPercent: number;
  discountedUnitPaise: number;
  volumeDiscountUnitPaise: number;
  volumeDiscountPaise: number;
  quantity: number;
  merchandiseSubtotalPaise: number;
  discountedSubtotalPaise: number;
};

export function getConfiguredUnitPricePaise(
  productId: ProductId,
  colour?: Pick<GarmentColour, "type">,
  artwork: Artwork = {},
  neckLabel?: Partial<NeckLabel>,
): number {
  return Math.round(
    getConfiguredUnitPrice(productId, colour, artwork, neckLabel, false) * 100,
  );
}

/** Shared browser/server line calculation. Volume pricing is rounded per unit. */
export function getConfiguredLinePricingPaise(input: {
  productId: ProductId;
  colour?: Pick<GarmentColour, "type">;
  artwork?: Artwork;
  neckLabel?: Partial<NeckLabel>;
  quantity: number;
}): ConfiguredLinePricingPaise {
  const quantity = Number.isFinite(input.quantity) && input.quantity > 0
    ? Math.floor(input.quantity)
    : 0;
  const configuredUnitPaise = getConfiguredUnitPricePaise(
    input.productId,
    input.colour,
    input.artwork ?? {},
    input.neckLabel,
  );
  const discountPercent = getVolumeDiscountPercent(quantity);
  const discountedUnitPaise = Math.round(
    (configuredUnitPaise * (100 - discountPercent)) / 100,
  );
  const volumeDiscountUnitPaise = configuredUnitPaise - discountedUnitPaise;
  return {
    configuredUnitPaise,
    discountPercent,
    discountedUnitPaise,
    volumeDiscountUnitPaise,
    volumeDiscountPaise: volumeDiscountUnitPaise * quantity,
    quantity,
    merchandiseSubtotalPaise: configuredUnitPaise * quantity,
    discountedSubtotalPaise: discountedUnitPaise * quantity,
  };
}

export interface ConfiguredPricingSummary {
  undiscountedUnitPrice: number;
  discountedUnitPrice: number;
  lineSubtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxableSubtotal: number;
  gst: number;
  total: number;
}

/**
 * Single source of truth for the configurator's customer-facing totals.
 * Keeping this calculation in the pricing library prevents the studio
 * summary and the expandable breakdown from showing different meanings for
 * "Order total".
 */
export function getConfiguredPricingSummary(
  productId: ProductId,
  colour: GarmentColour | undefined,
  artwork: Artwork,
  neckLabel: NeckLabel | undefined,
  quantity: number,
  rushDelivery = false
): ConfiguredPricingSummary {
  const safeQuantity = Number.isFinite(quantity) && quantity > 0
    ? Math.floor(quantity)
    : 1;
  const line = getConfiguredLinePricingPaise({
    productId,
    colour,
    artwork,
    neckLabel,
    quantity: safeQuantity,
  });
  const rushUnitPaise = rushDelivery ? Math.round(RUSH_DELIVERY_FEE_PER_UNIT * 100) : 0;
  const taxableSubtotalPaise =
    line.discountedSubtotalPaise + rushUnitPaise * safeQuantity;
  const gstPaise = calculateTaxPaise(taxableSubtotalPaise);

  return {
    undiscountedUnitPrice: line.configuredUnitPaise / 100,
    discountedUnitPrice: (line.discountedUnitPaise + rushUnitPaise) / 100,
    lineSubtotal: line.merchandiseSubtotalPaise / 100,
    discountPercent: line.discountPercent,
    discountAmount: line.volumeDiscountPaise / 100,
    taxableSubtotal: taxableSubtotalPaise / 100,
    gst: gstPaise / 100,
    total: (taxableSubtotalPaise + gstPaise) / 100,
  };
}

// ============================================================
// PHASE 9A — volume discount
// ============================================================

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Pricing breakdown — reconstructs the same sequential adjustment math as
// applyUnitPriceAdjustments, but keeps each step's rupee impact around so it
// can be listed line-by-line (e.g. in the Studio Summary) instead of only
// showing the final number.
// ---------------------------------------------------------------------------

export interface PricingBreakdownRow {
  label: string;
  detail?: string;
  amount: number;
}

export interface PricingBreakdown {
  rows: PricingBreakdownRow[];
  unitPrice: number;
  lineSubtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxable: number;
  gst: number;
  total: number;
}

export function buildPricingBreakdown(
  productId: ProductId,
  colour: GarmentColour | undefined,
  artwork: Artwork,
  neckLabel: NeckLabel | undefined,
  quantity: number,
  rushDelivery = false
): PricingBreakdown {
  const basePrice = getBasePrice(productId);
  const adjustments = getUnitPriceAdjustments(colour, artwork, neckLabel, rushDelivery);

  const rows: PricingBreakdownRow[] = [{ label: "Base garment", amount: basePrice }];
  let running = basePrice;
  for (const adjustment of adjustments) {
    const before = running;
    running =
      adjustment.percent !== undefined
        ? running * (1 + adjustment.percent / 100)
        : running + (adjustment.amount ?? 0);
    rows.push({
      label: adjustment.label,
      detail: adjustment.percent !== undefined ? `+${adjustment.percent}%` : undefined,
      amount: running - before,
    });
  }

  const summary = getConfiguredPricingSummary(
    productId,
    colour,
    artwork,
    neckLabel,
    quantity,
    rushDelivery
  );

  return {
    rows,
    unitPrice: summary.undiscountedUnitPrice,
    lineSubtotal: summary.lineSubtotal,
    discountPercent: summary.discountPercent,
    discountAmount: summary.discountAmount,
    taxable: summary.taxableSubtotal,
    gst: summary.gst,
    total: summary.total,
  };
}
