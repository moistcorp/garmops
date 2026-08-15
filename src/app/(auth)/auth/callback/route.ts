import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_NEXT_COOKIE,
  decodeAuthNextCookie,
  safeInternalPath,
} from "@/lib/auth/redirects";
import { medusaRequest, setMedusaToken } from "@/lib/medusa/client";

export async function GET(request: NextRequest) {
  const next = safeInternalPath(
    decodeAuthNextCookie(request.cookies.get(AUTH_NEXT_COOKIE)?.value),
    "/account/orders",
  );
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const providerError = request.nextUrl.searchParams.get("error");

  if (!code || !state || providerError) {
    const response = NextResponse.redirect(new URL("/auth/error?code=AUTH_CALLBACK_FAILED", request.url));
    response.cookies.delete(AUTH_NEXT_COOKIE);
    return response;
  }

  try {
    const callback = new URLSearchParams({ code, state });
    const result = await medusaRequest<{ token?: string }>(
      `/auth/customer/google/callback?${callback.toString()}`,
      { actor: "public" },
    );
    if (!result.token) throw new Error("Google authentication did not return a token");

    await setMedusaToken("customer", result.token);
    const response = NextResponse.redirect(new URL(next, request.url));
    response.cookies.delete(AUTH_NEXT_COOKIE);
    return response;
  } catch {
    const response = NextResponse.redirect(new URL("/auth/error?code=AUTH_CALLBACK_FAILED", request.url));
    response.cookies.delete(AUTH_NEXT_COOKIE);
    return response;
  }
}
