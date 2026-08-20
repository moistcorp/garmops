import type { ArtworkFileType, ArtworkSide } from './types/configurator';

export type ArtworkQuality = {
  label: string;
  detail?: string;
  effectivePpi?: number;
  isVector: boolean;
};

export type ArtworkContrast = {
  ratio: number;
  lowContrast: boolean;
  message: string;
};

const GOOD_PPI = 300;
const SOFT_PPI = 150;

function isRaster(fileType: ArtworkFileType): boolean {
  return fileType === 'jpg' || fileType === 'png';
}

function channelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function hexRelativeLuminance(hex: string): number | undefined {
  const normalized = hex.trim().replace(/^#/, "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((character) => character + character).join("")
    : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return undefined;
  const red = channelToLinear(Number.parseInt(expanded.slice(0, 2), 16));
  const green = channelToLinear(Number.parseInt(expanded.slice(2, 4), 16));
  const blue = channelToLinear(Number.parseInt(expanded.slice(4, 6), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function getArtworkContrast(side: ArtworkSide | undefined, garmentHex: string): ArtworkContrast | undefined {
  if (!side || side.averageLuminance === undefined) return undefined;
  const garmentLuminance = hexRelativeLuminance(garmentHex);
  if (garmentLuminance === undefined) return undefined;
  const lighter = Math.max(side.averageLuminance, garmentLuminance);
  const darker = Math.min(side.averageLuminance, garmentLuminance);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  const lowContrast = ratio < 2;
  return {
    ratio,
    lowContrast,
    message: lowContrast
      ? "This artwork may disappear against the selected garment colour. Try a lighter artwork, a contrasting garment, or ask production to add an underbase."
      : "Artwork contrast looks clear against the selected garment colour.",
  };
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

  // Quality describes the untouched production source, not the format of the
  // simulator derivative. A low-resolution PNG remains a low-resolution source
  // even when its preview is normalized or vector-shaped.
  if (side.sourceIsVector === true || side.fileType === 'svg' || (side.fileType === 'ai' && side.sourceIsVector !== false && side.vectorized && !side.previewKind)) {
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
