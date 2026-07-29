import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/auth/redirects";
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
  return NextResponse.redirect(new URL(next, url.origin));
}
