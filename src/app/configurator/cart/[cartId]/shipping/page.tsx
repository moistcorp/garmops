import { BillingShippingStep } from "@/components/configurator/cart/BillingShippingStep";

interface ShippingPageProps {
  params: Promise<{ cartId: string }>;
}

export default async function ShippingPage({ params }: ShippingPageProps) {
  const { cartId } = await params;

  return (
    <main className="techpack-canvas min-h-screen px-4 pb-8 sm:pb-10">
      <div className="mx-auto max-w-6xl">
        <BillingShippingStep cartId={cartId} />
      </div>
    </main>
  );
}
