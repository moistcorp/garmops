import { NextRequest, NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";

export async function POST(request: NextRequest) {
  const form = Object.fromEntries((await request.formData()).entries());
  const destination = new URL("/payment/status", request.url);
  if (typeof form.udf1 === "string" && form.udf1) destination.searchParams.set("cartId", form.udf1);
  if (typeof form.txnid === "string" && form.txnid) destination.searchParams.set("txnid", form.txnid);
  try {
    await medusaRequest<Record<string, unknown>>("/garmops/payments/payu/callback", { method: "POST", actor: "public", body: form });
  } catch {
    // The status page performs the authenticated authoritative recheck.
  }
  return NextResponse.redirect(destination, 303);
}
