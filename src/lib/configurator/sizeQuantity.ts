import type { PrintAreaSize } from "./types/configurator";

export const MAX_CONFIGURATION_QUANTITY = 1_000_000;

const SIZE_ORDER: readonly PrintAreaSize[] = ["XS", "S", "M", "L", "XL", "XXL"];

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

export function getSmallestOrderedSize(
  sizeQuantities: Record<string, number>,
): PrintAreaSize | undefined {
  return SIZE_ORDER.find((size) => normalizeSizeQuantity(sizeQuantities[size]) > 0);
}
