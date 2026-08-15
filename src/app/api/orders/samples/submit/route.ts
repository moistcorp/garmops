import { NextRequest, NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";

type SampleSubmitOrder = { checkoutPaymentAttemptId: string | null; alreadyFinalized: boolean; orderId?: string | null; orderNumber?: string | null; subtotalPaise: number; taxPaise: number; totalPaise: number };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const items = Array.isArray(body?.items) ? body.items as Array<Record<string, unknown>> : [];
  const contact = (body?.contact ?? {}) as Record<string, unknown>;
  const shipping = (body?.shipping ?? {}) as Record<string, unknown>;
  const address = (shipping.address ?? {}) as Record<string, unknown>;
  try {
    const result = await medusaRequest<{ order: SampleSubmitOrder }>("/store/garmops/sample-checkout", { method: "POST", actor: "customer", body: { items, contact, shipping: { address: { address_1: address.addressLine1, address_2: address.addressLine2, city: address.city, province: address.state, postal_code: address.zip } }, orderNotes: body?.orderNotes, acceptedTerms: body?.acceptedTerms === true, idempotencyKey: body?.idempotencyKey } });
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "The sample order could not be saved" }, { status: 409 }); }
}
