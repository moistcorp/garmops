import type { ArtworkFileType } from "@/lib/configurator/types/configurator";

export type ArtworkPreviewKind = "vector" | "raster";

export type ArtworkProcessingStatus =
  | "idle"
  | "analysing"
  | "processing"
  | "ready"
  | "needs_review"
  | "failed";

export type ArtworkProcessingErrorCode =
  | "unsupported_format"
  | "mime_mismatch"
  | "too_large"
  | "decode_failed"
  | "unsafe_svg"
  | "vectorization_failed"
  | "vectorization_too_complex"
  | "ai_not_pdf_compatible"
  | "pdf_preview_failed"
  | "processing_limit"
  | "preview_generation_failed";

export interface ArtworkProcessingResult {
  status: ArtworkProcessingStatus;
  originalFileType: ArtworkFileType;
  previewKind?: ArtworkPreviewKind;
  previewMimeType?: string;
  previewBlob?: Blob;
  vectorized?: boolean;
  sourceIsVector?: boolean;
  backgroundRemoved?: boolean;
  backgroundRemovalConfidence?: number;
  pixelWidth?: number;
  pixelHeight?: number;
  averageLuminance?: number;
  detectedColorCount?: number;
  hasTransparency?: boolean;
  isContinuousTone?: boolean;
  warnings?: string[];
  errorCode?: ArtworkProcessingErrorCode;
}

export interface RasterArtworkAnalysis {
  pixelWidth: number;
  pixelHeight: number;
  hasTransparency: boolean;
  averageLuminance?: number;
  detectedColorCount: number;
  isContinuousTone: boolean;
  isFlatGraphicCandidate: boolean;
  background?: {
    color: string;
    confidence: number;
  };
  contentBounds?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
}

export class ArtworkProcessingError extends Error {
  readonly code: ArtworkProcessingErrorCode;

  constructor(code: ArtworkProcessingErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ArtworkProcessingError";
    this.code = code;
  }
}
