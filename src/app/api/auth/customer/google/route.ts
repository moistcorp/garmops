import { NextRequest, NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";
import {
  AUTH_NEXT_COOKIE,
  AUTH_NEXT_COOKIE_MAX_AGE_SECONDS,
  authCallbackUrl,
  safeInternalPath,
} from "@/lib/auth/redirects";

export async function GET(request: NextRequest) {
  const next = safeInternalPath(request.nextUrl.searchParams.get("next"), "/account/orders");
  const callback = authCallbackUrl();

  try {
    const result = await medusaRequest<{ location?: string }>("/auth/customer/google", {
      method: "POST",
      actor: "public",
      body: { callback_url: callback },
    });
    const location = result.location ? new URL(result.location) : null;
    if (!location || location.protocol !== "https:" || location.hostname !== "accounts.google.com") {
      throw new Error("Google authentication did not return a trusted redirect");
    }

    const response = NextResponse.redirect(location);
    response.cookies.set(AUTH_NEXT_COOKIE, encodeURIComponent(next), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: AUTH_NEXT_COOKIE_MAX_AGE_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/auth/error?code=GOOGLE_AUTH_START_FAILED", request.url));
  }
}
