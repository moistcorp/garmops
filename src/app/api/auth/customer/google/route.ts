import { NextRequest, NextResponse } from "next/server";
import { medusaOrigin } from "@/lib/medusa/client";
import { safeInternalPath } from "@/lib/auth/redirects";

export function GET(request: NextRequest) {
  const next = safeInternalPath(request.nextUrl.searchParams.get("next"), "/account/orders");
  const callback = new URL("/auth/callback", request.url);
  callback.searchParams.set("next", next);
  const target = new URL(`${medusaOrigin()}/auth/customer/google`);
  target.searchParams.set("callback_url", callback.toString());
  return NextResponse.redirect(target);
}
