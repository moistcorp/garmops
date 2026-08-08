import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { ensureCustomerAccount } from "@/lib/auth/ensurePersonalCustomerAccount";
import {
  AUTH_NEXT_COOKIE,
  decodeAuthNextCookie,
  safeInternalPath,
} from "@/lib/auth/redirects";
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

function redirectAfterAuth(origin: string, destination: string) {
  const response = NextResponse.redirect(new URL(destination, origin));
  response.cookies.set(AUTH_NEXT_COOKIE, "", {
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });
  return response;
}

function callbackFailureDestination(next: string): string {
  return /^\/configurator\/cart\/[^/]+\/shipping$/.test(next)
    ? `${next}?auth=cancelled`
    : "/auth/error?code=AUTH_CALLBACK_FAILED";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const fallback = isStaffSurface() ? "/orders" : "/account/orders";
  const next = safeInternalPath(
    url.searchParams.get("next") ??
      decodeAuthNextCookie(request.cookies.get(AUTH_NEXT_COOKIE)?.value),
    fallback,
  );
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
    return redirectAfterAuth(url.origin, callbackFailureDestination(next));
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return redirectAfterAuth(url.origin, callbackFailureDestination(next));
  }

  // Recovery must finish before any portal-specific checks.
  if (next === "/reset-password") {
    return redirectAfterAuth(url.origin, next);
  }

  if (isStaffSurface()) {
    const { data, error } = await supabase.rpc("get_staff_access_context");
    const staff = data?.[0];
    if (error || !staff?.active) {
      await supabase.auth.signOut();
      return redirectAfterAuth(url.origin, "/auth/error?code=STAFF_ACCESS_DENIED");
    }
    const destination = staff.must_use_mfa && !staff.mfa_satisfied
      ? `/settings/security?next=${encodeURIComponent(next)}`
      : next;
    return redirectAfterAuth(url.origin, destination);
  }

  try {
    await ensureCustomerAccount(supabase);
  } catch (accountError) {
    await supabase.auth.signOut();
    console.error("Customer account provisioning failed", {
      userId: userData.user.id,
      error: accountError instanceof Error ? accountError.message : "unknown",
    });
    return redirectAfterAuth(url.origin, "/auth/error?code=CUSTOMER_ACCESS_DENIED");
  }
  return redirectAfterAuth(url.origin, next);
}
