import "server-only";

import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/auth/constants";
import type { createClient } from "@/lib/supabase/server";

type SessionClient = Awaited<ReturnType<typeof createClient>>;

/** Ensures the authenticated email is reserved as a customer account.
 * The database rejects staff-reserved emails, so customer and staff access can
 * never coexist for one email address.
 */
export async function ensureCustomerAccount(
  supabase: SessionClient,
): Promise<string> {
  const rpc = supabase.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: string | null; error: { message: string } | null }>;
  const { data, error } = await rpc("ensure_customer_account", {
    p_terms_version: TERMS_VERSION,
    p_privacy_version: PRIVACY_VERSION,
  });
  if (error || !data) {
    throw new Error(error?.message ?? "Customer account could not be created");
  }
  return data;
}

// Temporary compatibility export while old imports are removed.
export const ensurePersonalCustomerAccount = ensureCustomerAccount;
