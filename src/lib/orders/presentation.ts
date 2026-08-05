export type OrderPricingPresentationItem = {
  quantity: number;
  lineTotalPaise: number;
  productSnapshot: unknown;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function paise(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

/** Aggregates every commercial line; identical products remain independent. */
export function summarizeOrderItemPricing(
  items: readonly OrderPricingPresentationItem[],
): {
  configuredMerchandisePaise: number;
  volumeDiscountPaise: number;
  rushPaise: number;
} {
  return items.reduce(
    (summary, item) => {
      const product = record(item.productSnapshot);
      const configuredUnitPaise = paise(product, "configuredUnitPaise");
      const rushPaise = paise(product, "rushSurchargePaise");
      const storedVolumeDiscountPaise = paise(product, "volumeDiscountPaise");
      const derivedVolumeDiscountPaise = Math.max(
        0,
        configuredUnitPaise * item.quantity + rushPaise - item.lineTotalPaise,
      );
      return {
        configuredMerchandisePaise:
          summary.configuredMerchandisePaise + configuredUnitPaise * item.quantity,
        volumeDiscountPaise:
          summary.volumeDiscountPaise +
          (storedVolumeDiscountPaise || derivedVolumeDiscountPaise),
        rushPaise: summary.rushPaise + rushPaise,
      };
    },
    {
      configuredMerchandisePaise: 0,
      volumeDiscountPaise: 0,
      rushPaise: 0,
    },
  );
}
