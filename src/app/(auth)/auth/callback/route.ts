import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/auth/redirects";
import { ensurePersonalCustomerAccount } from "@/lib/auth/ensurePersonalCustomerAccount";
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
  const next = safeInternalPath(url.searchParams.get("next"), "/account");
  const supabase = await createClient();

  let error: unknown;
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type && OTP_TYPES.has(type)) {
    ({ error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    }));
  } else {
    error = new Error("Missing authentication callback token");
  }

  if (error) {
    return NextResponse.redirect(
      new URL("/auth/error?code=AUTH_CALLBACK_FAILED", url.origin),
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.redirect(
      new URL("/auth/error?code=AUTH_CALLBACK_FAILED", url.origin),
    );
  }
  try {
    // Password recovery must finish on the reset-password screen without
    // provisioning a customer workspace as a side effect.
    if (next !== "/reset-password") {
      const [staffResult, membershipResult] = await Promise.all([
        supabase
          .from("staff_members")
          .select("user_id")
          .eq("user_id", userData.user.id)
          .maybeSingle(),
        supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", userData.user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle(),
      ]);
      if (staffResult.error || membershipResult.error) {
        throw new Error("Account access could not be checked");
      }
      const staff = staffResult.data;
      const membership = membershipResult.data;
      if (staff && !membership) {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          new URL("/auth/error?code=STAFF_LOGIN_REQUIRED", url.origin),
        );
      }
      if (!membership) await ensurePersonalCustomerAccount(supabase);
    }
  } catch (accountError) {
    console.error("Customer workspace provisioning failed", {
      userId: userData.user.id,
      error: accountError instanceof Error ? accountError.message : "unknown",
    });
    return NextResponse.redirect(
      new URL("/auth/error?code=ACCOUNT_ACCESS_FAILED", url.origin),
    );
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
