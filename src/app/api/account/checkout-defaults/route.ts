import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasExpectedOrderOrigin } from "@/lib/orders/api";
import { readBoundedJson, RequestBodyError } from "@/lib/http/requestBody";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const addressSchema = z.object({
  country: z.literal("India"),
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(200).optional().default(""),
  zip: z.string().trim().regex(/^[1-9][0-9]{5}$/),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
});

const schema = z.object({
  contact: z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().max(80),
    email: z.string().trim().toLowerCase().email().max(320),
    phone: z.string().transform((value) => value.replace(/\D/g, "")).refine((value) => /^(?:91)?[6-9][0-9]{9}$/.test(value)),
  }),
  shipping: z.object({ address: addressSchema }),
  billing: z.object({
    sameAsCompanyAddress: z.boolean(),
    entity: z.string().trim().min(1).max(200),
    address: addressSchema,
    gstin: z.string().trim().toUpperCase().refine((value) => value === "" || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value)),
  }),
});

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(request: NextRequest) {
  if (!hasExpectedOrderOrigin(request)) return jsonError("Invalid request origin", 403);
  let body: unknown;
  try {
    body = await readBoundedJson(request, 32_000);
  } catch (error) {
    const status = error instanceof RequestBodyError && error.code === "too_large" ? 413 : 400;
    return jsonError("Invalid account details", status);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Check the delivery and billing details", 400);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user?.email || !user.email_confirmed_at) return jsonError("Verified customer login required", 401);
  const normalizedUserEmail = user.email.trim().toLowerCase();
  if (normalizedUserEmail !== parsed.data.contact.email) return jsonError("The delivery email must match the signed-in account", 409);

  const { data: principal, error: principalError } = await supabase.from("account_principals").select("account_type, active").eq("user_id", user.id).maybeSingle();
  if (principalError || principal?.account_type !== "customer" || !principal.active) return jsonError("Customer account access is unavailable", 403);

  const phoneDigits = parsed.data.contact.phone.startsWith("91") ? parsed.data.contact.phone.slice(2) : parsed.data.contact.phone;
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>;
  const { error } = await rpc("save_customer_checkout_defaults", {
    p_first_name: parsed.data.contact.firstName,
    p_last_name: parsed.data.contact.lastName,
    p_phone: `+91${phoneDigits}`,
    p_shipping_address: parsed.data.shipping.address,
    p_billing_entity: parsed.data.billing.entity,
    p_billing_address: parsed.data.billing.address,
    p_billing_same_as_shipping: parsed.data.billing.sameAsCompanyAddress,
    p_gstin: parsed.data.billing.gstin,
    p_billing_email: normalizedUserEmail,
  });
  if (error) {
    console.error("Customer checkout defaults could not be saved", { userId: user.id, error: error.message });
    return jsonError("Your account details could not be saved", 500);
  }
  return NextResponse.json({ ok: true });
}
