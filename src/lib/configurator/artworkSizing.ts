import type { Artwork, PrintAreaSize } from './types/configurator';

const SIZE_RANK: Record<PrintAreaSize, number> = {
  XS: 0,
  S: 1,
  M: 2,
  L: 3,
  XL: 4,
  XXL: 5,
};

export function artworkSmallestSize(artwork: Artwork): PrintAreaSize | undefined {
  return artwork.smallestSize ?? artwork.front?.printArea ?? artwork.back?.printArea;
}

export function getArtworkSizeConflict(
  artwork: Artwork,
  sizeQuantities: Record<string, number>,
): { configuredFor: PrintAreaSize; smallerSizes: string[] } | null {
  const configuredFor = artworkSmallestSize(artwork);
  if (!configuredFor || !Number.isFinite(SIZE_RANK[configuredFor])) return null;

  const smallerSizes = Object.entries(sizeQuantities)
    .filter(([size, quantity]) => quantity > 0 && size in SIZE_RANK && SIZE_RANK[size as PrintAreaSize] < SIZE_RANK[configuredFor])
    .map(([size]) => size);

  return smallerSizes.length ? { configuredFor, smallerSizes } : null;
}
