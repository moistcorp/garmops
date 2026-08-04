import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ensureCustomerAccount } from "@/lib/auth/ensurePersonalCustomerAccount";
import { safeInternalPath } from "@/lib/auth/redirects";
import { isStaffSurface } from "@/lib/config/appSurface";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "recovery",
  "invite",
  "email_change",
  "signup",
  "magiclink",
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const fallback = isStaffSurface() ? "/orders" : "/account/orders";
  const next = safeInternalPath(url.searchParams.get("next"), fallback);
  const supabase = await createClient();

  let callbackError: unknown;
  if (code) {
    ({ error: callbackError } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type && OTP_TYPES.has(type)) {
    ({ error: callbackError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else {
    callbackError = new Error("Missing authentication callback token");
  }

  if (callbackError) {
    return NextResponse.redirect(new URL("/auth/error?code=AUTH_CALLBACK_FAILED", url.origin));
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.redirect(new URL("/auth/error?code=AUTH_CALLBACK_FAILED", url.origin));
  }

  // Recovery must finish before any portal-specific checks.
  if (next === "/reset-password") {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  if (isStaffSurface()) {
    const rpc = supabase.rpc as unknown as (
      name: string,
    ) => Promise<{
      data: Array<{ active: boolean; must_use_mfa: boolean; mfa_satisfied: boolean }> | null;
      error: { message: string } | null;
    }>;
    const { data, error } = await rpc("get_staff_access_context");
    const staff = data?.[0];
    if (error || !staff?.active) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/auth/error?code=STAFF_ACCESS_DENIED", url.origin));
    }
    const destination = staff.must_use_mfa && !staff.mfa_satisfied
      ? `/settings/security?next=${encodeURIComponent(next)}`
      : next;
    return NextResponse.redirect(new URL(destination, url.origin));
  }

  try {
    await ensureCustomerAccount(supabase);
  } catch (accountError) {
    await supabase.auth.signOut();
    console.error("Customer account provisioning failed", {
      userId: userData.user.id,
      error: accountError instanceof Error ? accountError.message : "unknown",
    });
    return NextResponse.redirect(new URL("/auth/error?code=CUSTOMER_ACCESS_DENIED", url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
