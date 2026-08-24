import type {
  NeckLabel,
  NeckLabelDimensions,
  NeckLabelPosition,
  NeckLabelStitch,
} from './types/configurator';

export const NECK_LABEL_DIMENSIONS: readonly NeckLabelDimensions[] = [
  '50x18',
  '60x20',
  '65x15',
  '45x45',
];

export const NECK_LABEL_POSITION_LABELS: Record<NeckLabelPosition, string> = {
  below_neck_tape: 'Below neck tape',
  on_neck_tape: 'On neck tape',
};

export const TOTE_LABEL_POSITION_LABELS: Record<NeckLabelPosition, string> = {
  below_neck_tape: 'Inside top seam',
  // Legacy saved drafts are normalized to the only supported tote placement.
  on_neck_tape: 'Inside top seam',
};

export const NECK_LABEL_STITCH_LABELS: Record<NeckLabelStitch, string> = {
  '2_side': '2-side stitch',
  '4_corner': '4-corner stitch',
  '2_corner': '2-corner stitch',
};

const NECK_LABEL_STITCHES_BY_POSITION: Record<NeckLabelPosition, readonly NeckLabelStitch[]> = {
  below_neck_tape: ['2_side', '4_corner', '2_corner'],
  on_neck_tape: ['2_corner'],
};

export function neckLabelStitchesForPosition(
  position: NeckLabelPosition,
): readonly NeckLabelStitch[] {
  return NECK_LABEL_STITCHES_BY_POSITION[position];
}

export function normalizeNeckLabelStitch(
  position: NeckLabelPosition,
  stitch?: NeckLabelStitch,
): NeckLabelStitch {
  const allowed = neckLabelStitchesForPosition(position);
  return stitch && allowed.some((option) => option === stitch) ? stitch : '2_corner';
}

export function isCustomNeckLabel(
  label?: Partial<Pick<NeckLabel, 'labelType' | 'fileUrl' | 'fileId'>> | null,
): boolean {
  return label?.labelType === 'custom' || Boolean(label?.fileUrl || label?.fileId);
}

export function isStandardNeckLabel(
  label?: Partial<Pick<NeckLabel, 'labelType' | 'fileUrl' | 'fileId'>> | null,
): boolean {
  return label?.labelType === 'standard-size' || !isCustomNeckLabel(label);
}

export function createStandardNeckLabel(): NeckLabel {
  return {
    labelType: 'standard-size',
    fileUrl: '',
    dimensions: '50x18',
    position: 'below_neck_tape',
    stitch: '2_corner',
    confirmed: false,
  };
}
