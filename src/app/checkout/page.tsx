import PortalPlaceholder from "@/components/portal/PortalPlaceholder";
import DurableSampleCheckout from "@/components/checkout/DurableSampleCheckout";
import { requireOrganizationMember } from "@/lib/auth/guards";
import { isFeatureEnabled } from "@/lib/config/featureFlags";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  if (!isFeatureEnabled("DURABLE_SAMPLE_CHECKOUT_ENABLED")) {
    return (
      <div className="techpack-canvas min-h-[70vh] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <PortalPlaceholder
            title="Sample checkout unavailable"
            description="Durable catalogue sample checkout is disabled for this environment. Your cart has not been submitted."
          />
        </div>
      </div>
    );
  }

  const { user, supabase, membership } = await requireOrganizationMember(
    "/checkout",
  );
  if (!['owner', 'buyer'].includes(membership.role)) {
    return (
      <div className="techpack-canvas min-h-[70vh] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <PortalPlaceholder
            title="Buyer access required"
            description="An organisation owner or buyer must submit and pay for catalogue sample orders."
          />
        </div>
      </div>
    );
  }

  const [{ data: profile }, { data: organization }, { data: defaultShipping }] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, phone")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select("display_name, legal_name")
      .eq("id", membership.organization_id)
      .maybeSingle(),
    supabase
      .from("addresses")
      .select("line1, line2, city, state, postal_code, country_code")
      .eq("organization_id", membership.organization_id)
      .eq("is_default_shipping", true)
      .maybeSingle(),
  ]);

  return (
    <DurableSampleCheckout
      defaults={{
        organizationId: membership.organization_id,
        organizationName:
          organization?.display_name ?? organization?.legal_name ?? "Your company",
        firstName: profile?.first_name ?? "",
        lastName: profile?.last_name ?? "",
        email: user.email ?? "",
        phone: profile?.phone ?? "",
        deliveryAddress: {
          country: defaultShipping?.country_code === "IN" ? "India" : "India",
          addressLine1: defaultShipping?.line1 ?? "",
          addressLine2: defaultShipping?.line2 ?? "",
          zip: defaultShipping?.postal_code ?? "",
          city: defaultShipping?.city ?? "",
          state: defaultShipping?.state ?? "",
        },
      }}
    />
  );
}
