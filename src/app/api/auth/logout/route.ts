import { NextRequest, NextResponse } from "next/server";
import { clearMedusaToken, medusaRequest } from "@/lib/medusa/client";
import { getServerEnvironment } from "@/lib/config/env";

export async function POST(request: NextRequest) {
  const appOrigin = new URL(getServerEnvironment().NEXT_PUBLIC_APP_URL).origin;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  let refererOrigin: string | undefined;
  if (referer) {
    try { refererOrigin = new URL(referer).origin; } catch { refererOrigin = undefined; }
  }
  const sourceOrigin = origin ?? refererOrigin;
  if (!sourceOrigin || sourceOrigin !== appOrigin) {
    return NextResponse.json({ error: "Cross-site logout is not allowed" }, { status: 403 });
  }
  try { await medusaRequest("/auth/session", { method: "DELETE", actor: "customer" }); } catch {}
  await clearMedusaToken("customer");
  return NextResponse.json({ ok: true });
}