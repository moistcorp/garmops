import {
  BillingShippingStep,
  type CheckoutAccountContext,
} from "@/components/configurator/cart/BillingShippingStep";
import { medusaRequest } from "@/lib/medusa/client";

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
    const response = await medusaRequest<{ customer?: { email?: string; first_name?: string; last_name?: string } }>("/store/customers/me", { actor: "customer" });
    const user = response.customer;
    if (!user?.email) return null;

    return {
      authenticatedEmail: user.email.trim().toLowerCase(),
      hasSavedDetails: false,
      defaults: {
        firstName: user.first_name ?? "",
        lastName: user.last_name ?? "",
        email: user.email.trim().toLowerCase(),
        phone: "",
        billingEmail: user.email.trim().toLowerCase(),
        billingEntity: "",
        billingSameAsShipping: true,
        gstin: "",
        shippingAddress: addressDefaults(),
        billingAddress: addressDefaults(),
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
