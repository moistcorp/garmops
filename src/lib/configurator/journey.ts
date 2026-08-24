export type CustomisationJourneyStep =
  | "garment-colour"
  | "artwork"
  | "neck-label";

export function getConfiguratorCtaLabel(
  openStep: CustomisationJourneyStep | null,
  options: {
    hasArtwork: boolean;
    hasCustomLabel: boolean;
    customLabelSelected?: boolean;
    isToteProduct: boolean;
    colourName?: string;
  },
): string {
  if (openStep === "garment-colour") {
    return options.colourName
      ? `Continue with ${options.colourName} →`
      : "Continue to artwork →";
  }
  if (openStep === "artwork") {
    if (!options.hasArtwork) return "Continue without artwork →";
    return options.isToteProduct ? "Continue to bag label →" : "Continue to neck label →";
  }
  if (openStep === "neck-label") {
    if (options.isToteProduct && !options.hasCustomLabel) return "Upload bag label to continue";
    if (options.customLabelSelected && !options.hasCustomLabel) return "Upload label artwork to continue";
    if (options.hasCustomLabel) return "Continue with custom label →";
    return "Continue with standard label →";
  }
  return "Continue to sizes";
}

export function getPaymentJourneyStep(
  isProcessing: boolean,
): "review" | "payment" {
  return isProcessing ? "payment" : "review";
}
