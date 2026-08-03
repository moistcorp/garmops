import { BillingShippingStep } from "@/components/configurator/cart/BillingShippingStep";
import { requireOrganizationMember } from "@/lib/auth/guards";
import { isFeatureEnabled } from "@/lib/config/featureFlags";

interface ShippingPageProps {
  params: Promise<{ cartId: string }>;
}

export default async function ShippingPage({ params }: ShippingPageProps) {
  const { cartId } = await params;
  const durableCheckoutEnabled = isFeatureEnabled(
    "DURABLE_CUSTOM_CHECKOUT_ENABLED",
  );
  let accountDefaults:
    | React.ComponentProps<typeof BillingShippingStep>["accountDefaults"]
    | undefined;

  if (durableCheckoutEnabled) {
    const { supabase, membership, user } = await requireOrganizationMember(
      `/configurator/cart/${cartId}/shipping`,
    );
    const [
      { data: organization },
      { data: profile },
      { data: defaultShipping },
      { data: defaultBilling },
    ] =
      await Promise.all([
        supabase
          .from("organizations")
          .select("gstin, billing_email")
          .eq("id", membership.organization_id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("first_name, last_name, phone")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("addresses")
          .select("line1, line2, city, state, postal_code, country_code")
          .eq("organization_id", membership.organization_id)
          .eq("is_default_shipping", true)
          .maybeSingle(),
        supabase
          .from("addresses")
          .select("line1, line2, city, state, postal_code, country_code")
          .eq("organization_id", membership.organization_id)
          .eq("is_default_billing", true)
          .maybeSingle(),
      ]);

    accountDefaults = {
      gstin: organization?.gstin ?? "",
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name === "Account" ? "" : profile?.last_name ?? "",
      email: user.email ?? "",
      phone: profile?.phone?.replace(/^\+91/, "") ?? "",
      billingEmail: organization?.billing_email ?? user.email ?? "",
      billingAddress: {
        country: defaultBilling?.country_code === "IN" ? "India" : "India",
        addressLine1: defaultBilling?.line1 ?? "",
        addressLine2: defaultBilling?.line2 ?? "",
        zip: defaultBilling?.postal_code ?? "",
        city: defaultBilling?.city ?? "",
        state: defaultBilling?.state ?? "",
      },
      shippingAddress: {
        country: defaultShipping?.country_code === "IN" ? "India" : "India",
        addressLine1: defaultShipping?.line1 ?? "",
        addressLine2: defaultShipping?.line2 ?? "",
        zip: defaultShipping?.postal_code ?? "",
        city: defaultShipping?.city ?? "",
        state: defaultShipping?.state ?? "",
      },
    };
  }

  return (
    <main className="techpack-cart-page techpack-studio-bg min-h-screen px-4 pb-8 sm:pb-10">
      <div className="mx-auto max-w-6xl">
        <BillingShippingStep
          cartId={cartId}
          accountDefaults={accountDefaults}
        />
      </div>
    </main>
  );
}
