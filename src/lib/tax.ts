/**
 * Garmops' customer-facing GST rule.
 *
 * Keep monetary calculations in integer paise and tax rates in basis points.
 * 500 basis points = 5.00%.
 */
export const GST_RATE_BASIS_POINTS = 500;
export const GST_PERCENT = GST_RATE_BASIS_POINTS / 100;

export const GST_HIGH_RATE_BASIS_POINTS = 1200;
export const GST_APPAREL_THRESHOLD_PAISE = 100_000;

const PRODUCT_TAX: Record<string, { hsnCode: string; fixedRateBasisPoints?: number }> = {
  "regular-fit-tee-200gsm": { hsnCode: "6109" },
  "boxy-fit-tee-200gsm": { hsnCode: "6109" },
  "regular-fit-tee-260gsm": { hsnCode: "6109" },
  "boxy-fit-tee-260gsm": { hsnCode: "6109" },
  "longsleeve-tee-260gsm": { hsnCode: "6109" },
  "polo-280gsm": { hsnCode: "6105" },
  "canvas-tote-bag": { hsnCode: "4202 22 20", fixedRateBasisPoints: GST_HIGH_RATE_BASIS_POINTS },
  "regular-fit-sweatshirt-320gsm": { hsnCode: "6110" },
  "regular-fit-hoodie-320gsm": { hsnCode: "6110" },
};

export function gstRateForProduct(productId: string, unitPricePaise: number): number {
  const tax = PRODUCT_TAX[productId];
  if (!tax) return GST_RATE_BASIS_POINTS;
  if (tax.fixedRateBasisPoints !== undefined) return tax.fixedRateBasisPoints;
  return unitPricePaise > GST_APPAREL_THRESHOLD_PAISE
    ? GST_HIGH_RATE_BASIS_POINTS
    : GST_RATE_BASIS_POINTS;
}

export function hsnCodeForProduct(productId: string): string {
  return PRODUCT_TAX[productId]?.hsnCode ?? "";
}

export function calculateTaxPaise(
  taxablePaise: number,
  rateBasisPoints = GST_RATE_BASIS_POINTS,
): number {
  if (!Number.isSafeInteger(taxablePaise) || taxablePaise < 0) {
    throw new Error("Taxable value must be a non-negative integer number of paise");
  }
  if (!Number.isSafeInteger(rateBasisPoints) || rateBasisPoints < 0 || rateBasisPoints > 100_000) {
    throw new Error("GST rate must be a valid integer basis-point value");
  }
  return Math.round((taxablePaise * rateBasisPoints) / 10_000);
}

export function formatGstRate(rateBasisPoints = GST_RATE_BASIS_POINTS): string {
  return `${(rateBasisPoints / 100).toFixed(rateBasisPoints % 100 === 0 ? 0 : 2)}%`;
}
