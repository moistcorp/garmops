import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: false, message: "Checkout defaults are managed by the Medusa checkout record." }, { status: 501 });
}
