import { AiPreviewError, renderAiPreviewBlob, renderPdfPreview } from "@/lib/configurator/aiPreview";
import type { ArtworkFileType } from "@/lib/configurator/types/configurator";
import { ArtworkProcessingError, type ArtworkProcessingResult } from "./types";
import { normalizeRaster } from "./raster";
import { sanitizeAndNormalizeSvg, svgBlob } from "./svg";

export async function normalizeArtwork(file: Blob, fileType: ArtworkFileType): Promise<ArtworkProcessingResult> {
  try {
    if (fileType === "svg") {
      const sanitized = sanitizeAndNormalizeSvg(await file.text());
      return {
        status: "ready",
        originalFileType: fileType,
        previewKind: "vector",
        previewMimeType: "image/svg+xml",
        previewBlob: svgBlob(sanitized.text),
        vectorized: false,
        sourceIsVector: true,
        warnings: sanitized.warnings,
      };
    }
    if (fileType === "ai") {
      const renderedPreview = await renderAiPreviewBlob(file);
      let previewBlob = renderedPreview;
      try {
        // AI previews may include a white page/background. Reuse the same
        // bounded raster cleanup as customer PNG/JPG uploads so the simulator
        // receives the artwork shape rather than a page rectangle.
        previewBlob = (await normalizeRaster(renderedPreview)).blob;
      } catch {
        // A valid embedded preview is still useful if cleanup is unavailable.
      }
      return {
        status: "ready",
        originalFileType: fileType,
        previewKind: "raster",
        previewMimeType: "image/png",
        previewBlob,
        vectorized: false,
        sourceIsVector: undefined,
        warnings: ["A safe simulator preview was prepared from the Illustrator file. The original AI file remains the production source."],
      };
    }
    if (fileType === "pdf") {
      const previewBlob = await renderPdfPreview(file);
      return {
        status: "ready",
        originalFileType: fileType,
        previewKind: "raster",
        previewMimeType: "image/png",
        previewBlob,
        vectorized: false,
        warnings: ["Preview prepared from page 1. The original PDF remains the production source."],
      };
    }

    const normalized = await normalizeRaster(file);
    return {
      status: "ready",
      originalFileType: fileType,
      previewKind: "raster",
      previewMimeType: "image/png",
      previewBlob: normalized.blob,
      vectorized: false,
      backgroundRemoved: normalized.backgroundRemoved,
      backgroundRemovalConfidence: normalized.analysis.background?.confidence,
      pixelWidth: normalized.analysis.pixelWidth,
      pixelHeight: normalized.analysis.pixelHeight,
      averageLuminance: normalized.analysis.averageLuminance,
      detectedColorCount: normalized.analysis.detectedColorCount,
      hasTransparency: normalized.analysis.hasTransparency || normalized.backgroundRemoved,
      isContinuousTone: normalized.analysis.isContinuousTone,
      warnings: normalized.backgroundRemoved
        ? ["A simple background was removed automatically for the simulator preview."]
        : normalized.analysis.isFlatGraphicCandidate
          ? ["This flat graphic was kept as a raster preview because no safe vector converter is installed."]
          : [],
    };
  } catch (error) {
    if (error instanceof AiPreviewError && error.code === "incompatible") {
      return {
        status: "needs_review",
        originalFileType: fileType,
        vectorized: false,
        warnings: ["We couldn't automatically prepare this AI file for preview. Export it with PDF compatibility enabled or upload SVG, PNG or JPG."],
        errorCode: "ai_not_pdf_compatible",
      };
    }
    if (error instanceof ArtworkProcessingError) {
      throw error;
    }
    throw new ArtworkProcessingError(
      fileType === "pdf" ? "pdf_preview_failed" : "preview_generation_failed",
      error instanceof Error ? error.message : "Artwork processing failed",
    );
  }
}
