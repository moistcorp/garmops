import { NextRequest, NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";
export async function POST(request: NextRequest) { const form = Object.fromEntries((await request.formData()).entries()); try { const result = await medusaRequest<Record<string, unknown>>("/garmops/payments/payu/callback", { method: "POST", actor: "public", body: form }); return NextResponse.json(result); } catch { return NextResponse.json({ ok: false }, { status: 400 }); } }
