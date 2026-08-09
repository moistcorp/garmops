// src/lib/configurator/types/configurator.ts

export type GarmentColourType = 'signature' | 'custom_dye';

export interface GarmentColour {
  type: GarmentColourType;
  name: string; // e.g. "Indian Almond" or Pantone code "104 U"
  hex: string;
  confirmed: boolean;
}

export type CustomerArtworkTechnique =
  | 'screen_print'
  | 'dtf'
  | 'reflective_print';

export type ArtworkTechnique = CustomerArtworkTechnique;

export function isCustomerArtworkTechnique(
  technique: ArtworkTechnique | undefined,
): technique is CustomerArtworkTechnique {
  return technique === 'screen_print' || technique === 'dtf' || technique === 'reflective_print';
}

export type ArtworkFileType = 'jpg' | 'png' | 'pdf' | 'svg' | 'ai';

export type ArtworkPlacementPreset =
  | 'left-chest'
  | 'centre-chest'
  | 'large-front'
  | 'upper-back'
  | 'centre-back'
  | 'large-back'
  | 'custom';

export type PrintAreaSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

export interface ArtworkGuidelines {
  maximumArea: boolean;
  leftChest: boolean;
}

export interface ArtworkSide {
  fileUrl: string;
  /** Private R2 metadata ID used by cloud designs. */
  fileId?: string;
  /** IndexedDB key for user uploads. `fileUrl` is a document-scoped object URL
   * and is recreated from this key when a saved draft is restored. */
  fileKey?: string;
  fileName?: string;
  fileType: ArtworkFileType;
  vectorized: boolean;
  technique?: ArtworkTechnique;
  placementPreset?: ArtworkPlacementPreset;
  width: number; // cm
  height: number; // cm
  fromNeck: number; // cm
  fromCenter: number; // cm
  printArea: PrintAreaSize;
  guidelines: ArtworkGuidelines;
  confirmed: boolean;
  /** Optional browser-side diagnostics used for preview and production warnings. */
  pixelWidth?: number;
  pixelHeight?: number;
  hasTransparency?: boolean;
  averageLuminance?: number;
}

export interface Artwork {
  front?: ArtworkSide;
  back?: ArtworkSide;
  /** The smallest garment size used to choose the safe print area. */
  smallestSize?: PrintAreaSize;
}

export type NeckLabelDimensions = '50x18' | '60x20' | '65x15' | '45x45'; // mm
export type NeckLabelPosition = 'below_neck_tape' | 'on_neck_tape';
export type NeckLabelStitch = '2_side' | '4_corner' | '2_corner';
export type NeckLabelType = 'standard-size' | 'custom';

export type NeckLabelFileType = 'svg' | 'ai';

export interface NeckLabel {
  /** Explicitly identifies the production choice. Omitted on old snapshots. */
  labelType?: NeckLabelType;
  fileUrl: string; // .svg or .ai only; empty for the standard size label
  /** Private R2 metadata ID used by cloud designs. */
  fileId?: string;
  /** IndexedDB key used to recreate an uploaded file after a reload. */
  fileKey?: string;
  fileName?: string;
  fileType?: NeckLabelFileType;
  source?: 'upload' | 'sample';
  dimensions: NeckLabelDimensions;
  position: NeckLabelPosition;
  stitch?: NeckLabelStitch; // only present/relevant when position = 'below_neck_tape'
  confirmed: boolean;
}
