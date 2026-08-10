import PortalPlaceholder from "@/components/portal/PortalPlaceholder";
import DurableSampleCheckout from "@/components/checkout/DurableSampleCheckout";
import { requireCustomer } from "@/lib/auth/guards";
import { isFeatureEnabled } from "@/lib/config/featureFlags";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  if (!isFeatureEnabled("SAMPLE_CHECKOUT_ENABLED")) {
    return (
      <div className="techpack-canvas min-h-[70vh] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <PortalPlaceholder
            title="Sample checkout unavailable"
            description="Catalogue sample checkout is disabled for this environment. Your cart has not been submitted."
          />
        </div>
      </div>
    );
  }

  const { user, supabase } = await requireCustomer("/checkout");
  const [{ data: profile }, { data: defaultShipping }] = await Promise.all([
    supabase.from("profiles").select("first_name, last_name, phone").eq("id", user.id).maybeSingle(),
    supabase.from("addresses")
      .select("line1, line2, city, state, postal_code, country_code")
      .eq("user_id", user.id)
      .eq("is_default_shipping", true)
      .maybeSingle(),
  ]);

  return (
    <DurableSampleCheckout
      defaults={{
        firstName: profile?.first_name ?? "",
        lastName: profile?.last_name ?? "",
        email: user.email ?? "",
        phone: profile?.phone ?? "",
        deliveryAddress: {
          country: "India",
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
