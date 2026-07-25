// src/lib/configurator/types/configurator.ts

export type GarmentColourType = 'signature' | 'custom_dye';

export interface GarmentColour {
  type: GarmentColourType;
  name: string; // e.g. "Indian Almond" or Pantone code "104 U"
  hex: string;
  confirmed: boolean;
}

export type ArtworkTechnique =
  | 'screen_print'
  | 'dtg'
  | 'dtf'
  | 'reflective_heat_transfer'
  | 'puff_print'
  | 'embroidery';

export type ArtworkFileType = 'jpg' | 'png' | 'svg' | 'ai';

export type PrintAreaSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

export interface ArtworkGuidelines {
  maximumArea: boolean;
  leftChest: boolean;
}

export interface ArtworkSide {
  fileUrl: string;
  fileType: ArtworkFileType;
  vectorized: boolean;
  technique?: ArtworkTechnique;
  width: number; // cm
  height: number; // cm
  fromNeck: number; // cm
  fromCenter: number; // cm
  printArea: PrintAreaSize;
  guidelines: ArtworkGuidelines;
  confirmed: boolean;
}

export interface Artwork {
  front?: ArtworkSide;
  back?: ArtworkSide;
}

export type NeckLabelDimensions = '50x18' | '60x20' | '65x15' | '45x45'; // mm
export type NeckLabelPosition = 'below_neck_tape' | 'on_neck_tape';
export type NeckLabelStitch = '2_side' | '4_corner' | '2_corner';

export type NeckLabelFileType = 'svg' | 'ai';

export interface NeckLabel {
  fileUrl: string; // .svg or .ai only
  fileType?: NeckLabelFileType; // drives whether the live preview can rasterize the file (svg) or must show a placeholder (ai — browsers can't render it)
  source?: 'upload' | 'sample';
  dimensions: NeckLabelDimensions;
  position: NeckLabelPosition;
  stitch?: NeckLabelStitch; // only present/relevant when position = 'below_neck_tape'
  confirmed: boolean;
}
