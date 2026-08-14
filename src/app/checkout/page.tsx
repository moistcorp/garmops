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

  const { user } = await requireCustomer("/checkout");

  return (
    <DurableSampleCheckout
      defaults={{
        firstName: user.first_name ?? "",
        lastName: user.last_name ?? "",
        email: user.email ?? "",
        phone: "",
        deliveryAddress: {
          country: "India",
          addressLine1: "",
          addressLine2: "",
          zip: "",
          city: "",
          state: "",
        },
      }}
    />
  );
}
