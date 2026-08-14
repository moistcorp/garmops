import { NextRequest, NextResponse } from "next/server";
import { medusaRequest } from "@/lib/medusa/client";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const items = Array.isArray(body?.items) ? body.items as Array<Record<string, unknown>> : [];
  const contact = (body?.contact ?? {}) as Record<string, unknown>;
  const shipping = (body?.shipping ?? {}) as Record<string, unknown>;
  const address = (shipping.address ?? {}) as Record<string, unknown>;
  try {
    const created = await medusaRequest<{ cart: { cartId: string } }>("/store/garmops/cart", { method: "POST", actor: "customer", body: { cartType: "sample", email: contact.email } });
    const cartId = created.cart.cartId;
    for (const item of items) await medusaRequest("/store/garmops/sample-cart", { method: "POST", actor: "customer", body: { cartId, productSlug: String(item.productId), size: item.size, quantity: item.quantity } });
    await medusaRequest("/store/garmops/checkout/prepare", { method: "POST", actor: "customer", body: { cartId, email: contact.email, orderNotes: body?.orderNotes, termsVersion: "2026-07-29", privacyVersion: "2026-07-29", shippingAddress: { first_name: contact.firstName, last_name: contact.lastName, address_1: address.addressLine1, address_2: address.addressLine2, city: address.city, province: address.state, postal_code: address.zip, country_code: "in", phone: contact.phone }, billingAddress: { first_name: contact.firstName, last_name: contact.lastName, address_1: address.addressLine1, address_2: address.addressLine2, city: address.city, province: address.state, postal_code: address.zip, country_code: "in", phone: contact.phone } } });
    return NextResponse.json({ order: { checkoutPaymentAttemptId: cartId, alreadyFinalized: false, subtotalPaise: 0, taxPaise: 0, totalPaise: 0 } }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "The sample order could not be saved" }, { status: 409 }); }
}
