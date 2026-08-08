import type { ArtworkFileType, ArtworkSide } from './types/configurator';

export type ArtworkQuality = {
  label: string;
  detail?: string;
  effectivePpi?: number;
  isVector: boolean;
};

const GOOD_PPI = 300;
const SOFT_PPI = 150;

function isRaster(fileType: ArtworkFileType): boolean {
  return fileType === 'jpg' || fileType === 'png';
}

export function effectiveArtworkPpi(side: Pick<ArtworkSide, 'fileType' | 'pixelWidth' | 'pixelHeight' | 'width' | 'height'>): number | undefined {
  if (!isRaster(side.fileType) || !side.pixelWidth || !side.pixelHeight || side.width <= 0 || side.height <= 0) {
    return undefined;
  }

  const widthInches = side.width / 2.54;
  const heightInches = side.height / 2.54;
  return Math.min(side.pixelWidth / widthInches, side.pixelHeight / heightInches);
}

export function getArtworkQuality(side?: ArtworkSide): ArtworkQuality | undefined {
  if (!side) return undefined;

  if (side.vectorized || side.fileType === 'svg' || side.fileType === 'ai') {
    return { label: 'Vector artwork', detail: 'Our team will review the file for production.', isVector: true };
  }

  if (side.fileType === 'pdf') {
    return { label: 'Artwork will be reviewed for production.', isVector: false };
  }

  const ppi = effectiveArtworkPpi(side);
  if (!ppi) {
    return { label: 'Artwork will be reviewed for production.', isVector: false };
  }

  const roundedPpi = Math.round(ppi);
  if (ppi >= GOOD_PPI) {
    return { label: 'Good at this size', effectivePpi: roundedPpi, isVector: false };
  }
  if (ppi >= SOFT_PPI) {
    return { label: 'Acceptable at this size', effectivePpi: roundedPpi, isVector: false };
  }

  return {
    label: 'May print soft at this size',
    detail: `This image may lose sharpness at ${side.width} cm wide.`,
    effectivePpi: roundedPpi,
    isVector: false,
  };
}
