// src/lib/configurator/sizecharts.ts

import type { PrintAreaSize } from './types/configurator';

export interface PrintAreaDimensions {
  width: number; // cm
  height: number; // cm
}

export interface ArtworkPlacementArea extends PrintAreaDimensions {
  /** Origin of the calibrated area in the artwork placement coordinate system. */
  origin: {
    topOffsetCm: number;
    centerOffsetCm: number;
  };
}

// Production print areas begin three inches below the neck seam.
export const PRINT_AREA_TOP_OFFSET_CM = 3 * 2.54;
export const DEFAULT_ARTWORK_PRINT_AREA: PrintAreaSize = 'L';

export const PRINT_AREA_SIZE_CHART: Record<PrintAreaSize, PrintAreaDimensions> = {
  XS: { width: 31, height: 43 },
  S: { width: 32.5, height: 45.5 },
  M: { width: 34, height: 48 },
  L: { width: 35.5, height: 50 },
  XL: { width: 38, height: 50 },
  XXL: { width: 40, height: 50 },
};
