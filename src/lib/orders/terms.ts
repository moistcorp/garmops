export const CUSTOM_ORDER_TERMS_VERSION = "reservation-v1-2026-07-29";

export const SAMPLE_ORDER_TERMS_VERSION = "catalogue-sample-v1-2026-07-31";
export const SAMPLE_ORDER_TERMS_DOCUMENT_HASH =
  "d782e4f1705ac3e9d9203fc5292898ba92805952bc92017f48548544b76e078c";

export function currentSampleTermsEvidence() {
  return Object.freeze({
    version: SAMPLE_ORDER_TERMS_VERSION,
    documentHash: SAMPLE_ORDER_TERMS_DOCUMENT_HASH,
  });
}
