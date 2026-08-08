import type {
  ArtworkPlacementPreset,
  ArtworkSide,
} from './types/configurator';
import type { PrintAreaDimensions } from './sizecharts';
import {
  clampDim,
  constrainArtworkToPrintArea,
  getArtworkPlacementBounds,
  type PositionControlsState,
} from './ArtworkPositionContext';

export type ArtworkPlacementPresetOption = {
  id: ArtworkPlacementPreset;
  label: string;
  description: string;
};

export const FRONT_PLACEMENT_PRESETS: ArtworkPlacementPresetOption[] = [
  { id: 'left-chest', label: 'Left Chest', description: 'Compact logo placement' },
  { id: 'centre-chest', label: 'Centre Chest', description: 'Balanced chest placement' },
  { id: 'large-front', label: 'Large Front', description: 'Larger front graphic' },
  { id: 'custom', label: 'Custom', description: 'Keep the current placement' },
];

export const BACK_PLACEMENT_PRESETS: ArtworkPlacementPresetOption[] = [
  { id: 'upper-back', label: 'Upper Back', description: 'Logo below the collar' },
  { id: 'centre-back', label: 'Centre Back', description: 'Balanced back placement' },
  { id: 'large-back', label: 'Large Back', description: 'Larger back graphic' },
  { id: 'custom', label: 'Custom', description: 'Keep the current placement' },
];

function ratioFor(side: Pick<ArtworkSide, 'width' | 'height'>): number {
  return side.width > 0 && side.height > 0 ? side.height / side.width : 0.42;
}

function defaultWidth(
  preset: Exclude<ArtworkPlacementPreset, 'custom'>,
  area: PrintAreaDimensions,
): number {
  switch (preset) {
    case 'left-chest':
      return Math.min(10, area.width * 0.36);
    case 'centre-chest':
      return area.width * 0.56;
    case 'large-front':
      return area.width * 0.86;
    case 'upper-back':
      return area.width * 0.52;
    case 'centre-back':
      return area.width * 0.72;
    case 'large-back':
      return area.width * 0.9;
  }
}

function defaultPosition(
  preset: Exclude<ArtworkPlacementPreset, 'custom'>,
  area: PrintAreaDimensions,
  widthCm: number,
  heightCm: number,
): Pick<PositionControlsState, 'fromCenterCm' | 'fromNeckCm'> {
  const bounds = getArtworkPlacementBounds({ widthCm, heightCm }, area);
  const verticalOffset =
    preset === 'left-chest' || preset === 'upper-back'
      ? area.height * 0.08
      : preset === 'centre-chest' || preset === 'centre-back'
        ? area.height * 0.25
        : area.height * 0.05;

  return {
    fromCenterCm: preset === 'left-chest' ? Math.min(9, bounds.maxFromCenterCm * 0.86) : 0,
    fromNeckCm: clampDim(
      bounds.minFromNeckCm + verticalOffset,
      bounds.minFromNeckCm,
      bounds.maxFromNeckCm,
    ),
  };
}

export function applyArtworkPlacementPreset(
  current: PositionControlsState,
  preset: ArtworkPlacementPreset,
  area: PrintAreaDimensions,
  artworkAspect: Pick<ArtworkSide, 'width' | 'height'>,
): PositionControlsState {
  if (preset === 'custom') return { ...current, alignH: null, alignV: null };

  const widthCm = defaultWidth(preset, area);
  const heightCm = clampDim(widthCm * ratioFor(artworkAspect));
  const position = defaultPosition(preset, area, widthCm, heightCm);
  return constrainArtworkToPrintArea(
    {
      ...current,
      widthCm,
      heightCm,
      aspectLocked: true,
      alignH: null,
      alignV: null,
      ...position,
    },
    area,
  );
}

export function placementLabel(preset?: ArtworkPlacementPreset): string {
  if (!preset || preset === 'custom') return 'Custom';
  return [...FRONT_PLACEMENT_PRESETS, ...BACK_PLACEMENT_PRESETS].find((option) => option.id === preset)?.label ?? 'Custom';
}
