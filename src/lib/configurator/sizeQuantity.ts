import type { PrintAreaSize } from "./types/configurator";

export const MAX_CONFIGURATION_QUANTITY = 1_000_000;

const SIZE_ORDER: readonly PrintAreaSize[] = ["XS", "S", "M", "L", "XL", "XXL"];

// These profiles keep the prepared split centred on the most common sizes
// while still allowing the allocation utility to work with any product size
// list. Values are relative weights, not percentages, so integer apportioning
// can reconcile every result to the requested total.
const SIZE_COUNT_WEIGHT_PROFILES: Record<number, readonly number[]> = {
  1: [1],
  2: [1, 1],
  3: [1, 2, 1],
  4: [18, 32, 32, 18],
  5: [10, 22, 36, 22, 10],
  6: [6, 16, 28, 28, 16, 6],
};

function getSizeDistributionWeights(sizeCount: number): number[] {
  const profile = SIZE_COUNT_WEIGHT_PROFILES[sizeCount];
  if (profile) return [...profile];

  // A smooth, symmetric bell curve for uncommon size counts. The centre
  // receives the most weight and the ends remain represented without relying
  // on particular size names.
  const centre = (sizeCount - 1) / 2;
  const radius = Math.max(centre, 0.5);
  return Array.from({ length: sizeCount }, (_, index) => {
    const distance = Math.abs(index - centre) / radius;
    return Math.max(0.05, Math.exp(-3 * distance * distance));
  });
}

export function normalizeSizeQuantity(
  value: unknown,
  maximum = MAX_CONFIGURATION_QUANTITY,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.max(0, Math.floor(maximum)), Math.floor(parsed));
}

/**
 * Parses an editable quantity field without accepting decimal, signed, or
 * scientific notation. Invalid text leaves the last valid value untouched.
 */
export function parseSizeQuantityInput(
  raw: string,
  previous: number,
  maximum = MAX_CONFIGURATION_QUANTITY,
): number {
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  if (!/^\d+$/.test(trimmed)) return normalizeSizeQuantity(previous, maximum);
  return normalizeSizeQuantity(trimmed, maximum);
}

/**
 * Builds a deterministic recommended size split whose integer quantities sum
 * exactly to targetQuantity. Existing allocations should be passed through by
 * the caller; this utility only calculates a new recommendation.
 */
export function getRecommendedSizeAllocation(
  sizes: readonly string[],
  targetQuantity: number,
): Record<string, number> {
  const safeTarget = Number.isFinite(targetQuantity)
    ? Math.min(MAX_CONFIGURATION_QUANTITY, Math.max(0, Math.floor(targetQuantity)))
    : 0;

  if (sizes.length === 0) return {};

  const weights = getSizeDistributionWeights(sizes.length);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const entries = sizes.map((size, index) => {
    const exact = safeTarget * weights[index] / totalWeight;
    const quantity = Math.floor(exact);
    return {
      size,
      quantity,
      remainder: exact - quantity,
      index,
    };
  });

  let allocated = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  // Stable index ordering makes tied fractional remainders deterministic.
  entries
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    .forEach((entry) => {
      if (allocated >= safeTarget) return;
      entry.quantity += 1;
      allocated += 1;
    });

  return Object.fromEntries(
    entries
      .sort((left, right) => left.index - right.index)
      .map((entry) => [entry.size, entry.quantity]),
  );
}

export function getSmallestOrderedSize(
  sizeQuantities: Record<string, number>,
): PrintAreaSize | undefined {
  return SIZE_ORDER.find((size) => normalizeSizeQuantity(sizeQuantities[size]) > 0);
}
