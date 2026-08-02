import "server-only";

import { getProduct } from "@/lib/configurator/products";
import {
  getConfiguredUnitPrice,
  getBasePrice,
  hasArtworkAsset,
  hasNeckLabelAsset,
} from "@/lib/configurator/pricing";
import { GST_PERCENT, getVolumeDiscountPercent } from "@/lib/pricingRules";
import { getServerEnvironment } from "@/lib/config/env";
import type { Artwork, ArtworkSide, NeckLabel } from "@/lib/configurator/types/configurator";
import type { CloudDesignSnapshot } from "@/lib/designs/schema";
import type { EstimatePricingResult, EstimateSnapshot } from "./types";

export const ESTIMATE_PRICING_ENGINE_VERSION = "2026-08-02";

function priceableArtwork(snapshot: CloudDesignSnapshot): Artwork {
  const side = (value?: CloudDesignSnapshot["configuration"]["artwork"]["front"]): ArtworkSide | undefined =>
    value ? ({ ...value, fileUrl: value.fileUrl ?? (value.fileId ? `private-file:${value.fileId}` : "") } as ArtworkSide) : undefined;
  return {
    front: side(snapshot.configuration.artwork.front),
    back: side(snapshot.configuration.artwork.back),
  };
}

function priceableLabel(snapshot: CloudDesignSnapshot): NeckLabel | undefined {
  const value = snapshot.configuration.neckLabel;
  return value
    ? ({ ...value, fileUrl: value.fileUrl ?? (value.fileId ? `private-file:${value.fileId}` : "") } as NeckLabel)
    : undefined;
}

function placement(value: { fromNeck: number; fromCenter: number }): string {
  return `${value.fromNeck} cm below neck, ${value.fromCenter} cm from centre`;
}

export function calculateEstimatePricing(snapshot: CloudDesignSnapshot): EstimatePricingResult {
  const product = getProduct(snapshot.configId);
  if (!product) throw new Error("Design product is no longer available");
  const quantity = snapshot.configuration.quantity;
  const artwork = priceableArtwork(snapshot);
  const neckLabel = priceableLabel(snapshot);
  const configuredUnitRupees = getConfiguredUnitPrice(
    product.id,
    snapshot.configuration.colour,
    artwork,
    neckLabel,
    false,
  );
  const baseUnitPricePaise = Math.round(getBasePrice(product.id) * 100);
  const configuredUnitPricePaise = Math.round(configuredUnitRupees * 100);
  const discountPercent = getVolumeDiscountPercent(quantity);
  // Rounding policy: round the configured unit price to paise, then round the
  // volume-discounted unit price; all line totals derive from that unit value.
  const discountedUnitPricePaise = Math.round(
    (configuredUnitPricePaise * (100 - discountPercent)) / 100,
  );
  const subtotalPaise = configuredUnitPricePaise * quantity;
  const discountPaise = subtotalPaise - discountedUnitPricePaise * quantity;
  const taxableSubtotalPaise = subtotalPaise - discountPaise;
  const gstRateBasisPoints = GST_PERCENT * 100;
  const gstPaise = Math.round((taxableSubtotalPaise * GST_PERCENT) / 100);
  const totalPaise = taxableSubtotalPaise + gstPaise;
  const reservationFeePaise = getServerEnvironment().RESERVATION_AMOUNT_PAISE;

  return {
    pricingEngineVersion: ESTIMATE_PRICING_ENGINE_VERSION,
    baseUnitPricePaise,
    configuredUnitPricePaise,
    discountedUnitPricePaise,
    subtotalPaise,
    discountPaise,
    taxableSubtotalPaise,
    gstRateBasisPoints,
    gstPaise,
    shippingPaise: null,
    totalPaise,
    reservationFeePaise,
    balanceDuePaise: Math.max(0, totalPaise - reservationFeePaise),
    lineItems: [
      {
        label: `${product.name} and customisation`,
        quantity,
        unitPricePaise: configuredUnitPricePaise,
        totalPaise: subtotalPaise,
      },
    ],
  };
}

export function buildEstimateSnapshot(
  design: CloudDesignSnapshot,
  company: EstimateSnapshot["company"],
  pricing: EstimatePricingResult,
): EstimateSnapshot {
  const product = getProduct(design.configId);
  if (!product) throw new Error("Design product is no longer available");
  const side = (value?: CloudDesignSnapshot["configuration"]["artwork"]["front"]) => ({
    present: hasArtworkAsset(value),
    ...(value?.technique ? { technique: value.technique } : {}),
    ...(value ? { width: value.width, height: value.height, placement: placement(value), fileName: value.fileName } : {}),
  });
  const label = design.configuration.neckLabel;
  return {
    schemaVersion: 1,
    pricingEngineVersion: pricing.pricingEngineVersion,
    product: { id: product.id, name: product.name, baseUnitPricePaise: pricing.baseUnitPricePaise },
    quantity: design.configuration.quantity,
    colour: {
      type: design.configuration.colour.type,
      name: design.configuration.colour.name,
      hex: design.configuration.colour.hex,
    },
    customisation: {
      front: side(design.configuration.artwork.front),
      back: side(design.configuration.artwork.back),
      neckLabel: {
        present: hasNeckLabelAsset(label),
        ...(label ? { dimensions: label.dimensions, position: label.position, fileName: label.fileName } : {}),
      },
    },
    lineItems: pricing.lineItems,
    discount: { percent: getVolumeDiscountPercent(design.configuration.quantity), amountPaise: pricing.discountPaise },
    tax: { rateBasisPoints: pricing.gstRateBasisPoints, amountPaise: pricing.gstPaise },
    shipping: { included: false, amountPaise: null, note: "Calculated after delivery address is confirmed" },
    company,
    termsVersion: "estimate-v1",
  };
}
