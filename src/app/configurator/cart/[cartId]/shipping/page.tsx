import {
  BillingShippingStep,
  type CheckoutAccountContext,
} from "@/components/configurator/cart/BillingShippingStep";
import { createClient } from "@/lib/supabase/server";

interface ShippingPageProps {
  params: Promise<{ cartId: string }>;
  searchParams: Promise<{ auth?: string }>;
}

export const dynamic = "force-dynamic";

type StoredAddress = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
};

type BillingAddressJson = {
  addressLine1?: unknown;
  addressLine2?: unknown;
  city?: unknown;
  state?: unknown;
  zip?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function addressDefaults(
  row?: StoredAddress | null,
  fallback?: BillingAddressJson | null,
) {
  return {
    country: "India",
    addressLine1: row?.line1 ?? text(fallback?.addressLine1),
    addressLine2: row?.line2 ?? text(fallback?.addressLine2),
    zip: row?.postal_code ?? text(fallback?.zip),
    city: row?.city ?? text(fallback?.city),
    state: row?.state ?? text(fallback?.state),
  };
}

async function loadCheckoutAccountContext(): Promise<CheckoutAccountContext | null> {
  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user?.email || !user.email_confirmed_at) return null;

    const { data: principal } = await supabase
      .from("account_principals")
      .select("account_type, active")
      .eq("user_id", user.id)
      .maybeSingle();
    if (principal?.account_type !== "customer" || !principal.active) return null;

    const [profileResult, addressesResult, billingResult] = await Promise.all([
      supabase.from("profiles").select("first_name, last_name, phone").eq("id", user.id).maybeSingle(),
      supabase.from("addresses").select("line1, line2, city, state, postal_code, is_default_shipping, is_default_billing").eq("user_id", user.id),
      supabase.from("customer_billing_profiles").select("legal_business_name, gstin, billing_email, billing_address").eq("user_id", user.id).maybeSingle(),
    ]);

    const addresses = (addressesResult.data ?? []) as Array<StoredAddress & { is_default_shipping?: boolean; is_default_billing?: boolean }>;
    const shipping = addresses.find((address) => address.is_default_shipping);
    const billing = addresses.find((address) => address.is_default_billing);
    const billingJson = billingResult.data?.billing_address && typeof billingResult.data.billing_address === "object" && !Array.isArray(billingResult.data.billing_address)
      ? (billingResult.data.billing_address as BillingAddressJson)
      : null;

    const profile = profileResult.data;
    const billingProfile = billingResult.data;
    const hasSavedDetails = Boolean(profile?.phone || shipping || billing || billingProfile?.gstin || billingProfile?.legal_business_name);
    const placeholderProfile = profile?.first_name === "Customer" && profile?.last_name === "Account";

    return {
      authenticatedEmail: user.email.trim().toLowerCase(),
      hasSavedDetails,
      defaults: {
        firstName: placeholderProfile ? "" : (profile?.first_name ?? ""),
        lastName: placeholderProfile ? "" : (profile?.last_name ?? ""),
        email: user.email.trim().toLowerCase(),
        phone: profile?.phone ?? "",
        billingEmail: billingProfile?.billing_email ?? user.email.trim().toLowerCase(),
        billingEntity: billingProfile?.legal_business_name ?? "",
        billingSameAsShipping: !billing || billing === shipping,
        gstin: billingProfile?.gstin ?? "",
        shippingAddress: addressDefaults(shipping),
        billingAddress: addressDefaults(billing, billingJson),
      },
    };
  } catch (error) {
    console.error("Checkout account defaults could not be loaded", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

export default async function ShippingPage({ params, searchParams }: ShippingPageProps) {
  const [{ cartId }, query, accountContext] = await Promise.all([
    params,
    searchParams,
    loadCheckoutAccountContext(),
  ]);

  return (
    <main className="techpack-cart-page techpack-studio-bg min-h-screen px-4 pb-8 sm:pb-10">
      <div className="mx-auto max-w-6xl">
        <BillingShippingStep
          cartId={cartId}
          accountContext={accountContext ?? undefined}
          authNotice={query.auth === "cancelled" ? "Google sign-in wasn’t completed. Your order details are still here." : undefined}
        />
      </div>
    </main>
  );
}
