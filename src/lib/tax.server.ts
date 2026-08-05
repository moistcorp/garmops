import "server-only";

import { getServerEnvironment } from "@/lib/config/env";
import { GST_RATE_BASIS_POINTS } from "@/lib/tax";

/** Fail closed when deployment tax configuration disagrees with the code rule. */
export function configuredGstRateBasisPoints(): number {
  const configured = getServerEnvironment().INVOICE_GST_RATE_BASIS_POINTS;
  if (configured !== GST_RATE_BASIS_POINTS) {
    throw new Error(
      `GST configuration mismatch: expected ${GST_RATE_BASIS_POINTS} basis points but received ${configured}`,
    );
  }
  return GST_RATE_BASIS_POINTS;
}
