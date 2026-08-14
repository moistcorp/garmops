import { NextRequest, NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/auth/redirects";
import { setMedusaToken } from "@/lib/medusa/client";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? request.nextUrl.searchParams.get("access_token");
  const next = safeInternalPath(request.nextUrl.searchParams.get("next"), "/account/orders");
  if (!token) return NextResponse.redirect(new URL("/auth/error?code=AUTH_CALLBACK_FAILED", request.url));
  await setMedusaToken("customer", token);
  return NextResponse.redirect(new URL(next, request.url));
}
