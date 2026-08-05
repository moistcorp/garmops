/**
 * Garmops' customer-facing GST rule.
 *
 * Keep monetary calculations in integer paise and tax rates in basis points.
 * 500 basis points = 5.00%.
 */
export const GST_RATE_BASIS_POINTS = 500;
export const GST_PERCENT = GST_RATE_BASIS_POINTS / 100;

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
