import { NextRequest, NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";
export async function POST(request: NextRequest) { const body = await request.json().catch(async () => Object.fromEntries((await request.formData()).entries())); try { return NextResponse.json(await medusaRequest("/garmops/payments/payu/webhook", { method: "POST", actor: "public", body })); } catch { return NextResponse.json({ ok: false }, { status: 400 }); } }
