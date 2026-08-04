export type CustomisationJourneyStep =
  | "garment-colour"
  | "artwork"
  | "neck-label";

export function getConfiguratorCtaLabel(
  openStep: CustomisationJourneyStep | null,
  options: {
    hasArtwork: boolean;
    hasCustomLabel: boolean;
    isToteProduct: boolean;
  },
): string {
  if (openStep === "garment-colour") return "Continue";
  if (openStep === "artwork") {
    return options.hasArtwork ? "Continue" : "Skip artwork";
  }
  if (openStep === "neck-label") {
    if (options.hasCustomLabel) return "Continue to sizes";
    return options.isToteProduct
      ? "Use standard bag label"
      : "Use standard neck label";
  }
  return "Continue to sizes";
}

export function getPaymentJourneyStep(
  isProcessing: boolean,
): "review" | "payment" {
  return isProcessing ? "payment" : "review";
}
