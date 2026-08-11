import type { Artwork, PrintAreaSize } from './types/configurator';
import { DEFAULT_ARTWORK_PRINT_AREA, PRINT_AREA_SIZE_CHART, PRINT_AREA_TOP_OFFSET_CM } from './sizecharts';
import { getSmallestOrderedSize } from './sizeQuantity';

const SIZE_RANK: Record<PrintAreaSize, number> = {
  XS: 0,
  S: 1,
  M: 2,
  L: 3,
  XL: 4,
  XXL: 5,
};

export function artworkSmallestSize(artwork: Artwork): PrintAreaSize | undefined {
  return artwork.smallestSize ?? artwork.front?.printArea ?? artwork.back?.printArea ?? DEFAULT_ARTWORK_PRINT_AREA;
}

export function getArtworkSizeConflict(
  artwork: Artwork,
  sizeQuantities: Record<string, number>,
): {
  configuredFor: PrintAreaSize;
  actualSmallestSize: PrintAreaSize;
  smallerSizes: string[];
  unsafeSides: Array<'front' | 'back'>;
} | null {
  const configuredFor = artworkSmallestSize(artwork);
  if (!configuredFor || !Number.isFinite(SIZE_RANK[configuredFor])) return null;

  const actualSmallestSize = getSmallestOrderedSize(sizeQuantities);
  if (
    !actualSmallestSize ||
    SIZE_RANK[actualSmallestSize] >= SIZE_RANK[configuredFor]
  ) return null;

  const safeArea = PRINT_AREA_SIZE_CHART[actualSmallestSize];
  const epsilon = 0.001;
  const unsafeSides = (['front', 'back'] as const).filter((side) => {
    const placement = artwork[side];
    if (!placement) return false;
    const horizontalEdge = Math.abs(placement.fromCenter) + placement.width / 2;
    const safeHorizontalEdge = safeArea.width / 2;
    const safeBottom = PRINT_AREA_TOP_OFFSET_CM + safeArea.height;
    return (
      placement.width > safeArea.width + epsilon ||
      placement.height > safeArea.height + epsilon ||
      horizontalEdge > safeHorizontalEdge + epsilon ||
      placement.fromNeck < PRINT_AREA_TOP_OFFSET_CM - epsilon ||
      placement.fromNeck + placement.height > safeBottom + epsilon
    );
  });

  if (!unsafeSides.length) return null;
  return {
    configuredFor,
    actualSmallestSize,
    smallerSizes: [actualSmallestSize],
    unsafeSides,
  };
}
