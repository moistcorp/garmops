import { ConfirmationStep } from "@/components/configurator/cart/ConfirmationStep";
import { requireOrganizationMember } from "@/lib/auth/guards";
import { isFeatureEnabled } from "@/lib/config/featureFlags";

interface ConfirmationPageProps {
  params: Promise<{ cartId: string }>;
}

export default async function ConfirmationPage({ params }: ConfirmationPageProps) {
  const { cartId } = await params;
  const durableCheckoutEnabled = isFeatureEnabled(
    "DURABLE_CUSTOM_CHECKOUT_ENABLED",
  );
  const organizationId = durableCheckoutEnabled
    ? (
        await requireOrganizationMember(
          `/configurator/cart/${cartId}/confirmation`,
        )
      ).membership.organization_id
    : undefined;

  return (
    <main className="techpack-canvas min-h-screen px-4 pb-8 sm:pb-10">
      <div className="mx-auto max-w-6xl">
        <ConfirmationStep
          cartId={cartId}
          durableCheckoutEnabled={durableCheckoutEnabled}
          organizationId={organizationId}
        />
      </div>
    </main>
  );
}
