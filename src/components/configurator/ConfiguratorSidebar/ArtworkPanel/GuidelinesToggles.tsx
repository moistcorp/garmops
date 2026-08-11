import type { PrintAreaDimensions } from '@/lib/configurator/sizecharts';

// Matches the horizontal left-chest reference used by Assembly.
export const LEFT_CHEST_DIMENSIONS: PrintAreaDimensions = { width: 10, height: 6 };
export const LEFT_CHEST_PLACEMENT = {
  fromCenterCm: 9,
  fromNeckCm: 6,
} as const;
