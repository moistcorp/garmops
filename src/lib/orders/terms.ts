export const CONFIGURATOR_ORDER_TERMS_VERSION = "full-payment-v1-2026-08-04";
export const CHECKOUT_PRIVACY_VERSION = "privacy-v1-2026-08-04";
export const CONFIGURATOR_ORDER_TERMS_DOCUMENT_HASH =
  "7a1cfcabf3abf70a60fb2f2191a63941151c1041f42ea2f1dcf7f8aa9506825c";

export const SAMPLE_ORDER_TERMS_VERSION = "catalogue-sample-v1-2026-07-31";
export const SAMPLE_ORDER_TERMS_DOCUMENT_HASH =
  "d782e4f1705ac3e9d9203fc5292898ba92805952bc92017f48548544b76e078c";

export function currentConfiguratorTermsEvidence() {
  return Object.freeze({
    version: CONFIGURATOR_ORDER_TERMS_VERSION,
    privacyVersion: CHECKOUT_PRIVACY_VERSION,
    documentHash: CONFIGURATOR_ORDER_TERMS_DOCUMENT_HASH,
  });
}

export function currentSampleTermsEvidence() {
  return Object.freeze({
    version: SAMPLE_ORDER_TERMS_VERSION,
    documentHash: SAMPLE_ORDER_TERMS_DOCUMENT_HASH,
  });
}
