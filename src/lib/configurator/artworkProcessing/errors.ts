import type { ArtworkProcessingErrorCode } from "./types";

export function artworkProcessingMessage(code?: ArtworkProcessingErrorCode): string {
  switch (code) {
    case "ai_not_pdf_compatible":
      return "We couldn't automatically prepare this AI file for preview. Export it with PDF compatibility enabled or upload SVG, PNG or JPG.";
    case "unsafe_svg":
      return "This SVG contains unsupported active content. Export a clean SVG and try again.";
    case "too_large":
    case "processing_limit":
      return "This artwork is too large to prepare safely in the browser. Try a smaller export.";
    case "decode_failed":
    case "pdf_preview_failed":
      return "We couldn't prepare this artwork for preview. Try exporting it as SVG, PNG or JPG.";
    case "preview_generation_failed":
    case "vectorization_failed":
    case "vectorization_too_complex":
    case "mime_mismatch":
    case "unsupported_format":
    default:
      return "We couldn't prepare this artwork for preview. Try exporting it as SVG, PNG or JPG.";
  }
}
