import { BillingShippingStep } from "@/components/configurator/cart/BillingShippingStep";

interface ShippingPageProps {
  params: Promise<{ cartId: string }>;
}

/**
 * Delivery details remain guest-safe so customers can complete the configurator
 * before authenticating. The confirmation/payment route is responsible for
 * requiring a verified customer account.
 */
export default async function ShippingPage({ params }: ShippingPageProps) {
  const { cartId } = await params;

  return (
    <main className="techpack-cart-page techpack-studio-bg min-h-screen px-4 pb-8 sm:pb-10">
      <div className="mx-auto max-w-6xl">
        <BillingShippingStep cartId={cartId} />
      </div>
    </main>
  );
}
