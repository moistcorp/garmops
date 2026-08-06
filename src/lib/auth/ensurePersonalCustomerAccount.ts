import "server-only";

import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/auth/constants";
import type { createClient } from "@/lib/supabase/server";

type SessionClient = Awaited<ReturnType<typeof createClient>>;

type RpcError = {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
};

export class CustomerAccountProvisioningError extends Error {
  readonly code?: string;
  readonly details?: string;
  readonly hint?: string;

  constructor(error?: RpcError | null) {
    const context = [error?.code, error?.message, error?.details, error?.hint]
      .filter(Boolean)
      .join(" | ");
    super(context || "Customer account could not be created");
    this.name = "CustomerAccountProvisioningError";
    this.code = error?.code;
    this.details = error?.details;
    this.hint = error?.hint;
  }
}

/** Ensures the authenticated email is reserved as a customer account.
 * The database rejects staff-reserved emails, so customer and staff access can
 * never coexist for one email address.
 */
export async function ensureCustomerAccount(
  supabase: SessionClient,
): Promise<string> {
  const { data, error } = await supabase.rpc("ensure_customer_account", {
    p_terms_version: TERMS_VERSION,
    p_privacy_version: PRIVACY_VERSION,
  });
  if (error || !data) {
    throw new CustomerAccountProvisioningError(error);
  }
  return data;
}

// Temporary compatibility export while old imports are removed.
export const ensurePersonalCustomerAccount = ensureCustomerAccount;
