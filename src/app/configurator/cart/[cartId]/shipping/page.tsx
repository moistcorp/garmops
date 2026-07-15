import { BillingShippingStep } from "@/components/configurator/cart/BillingShippingStep";

interface ShippingPageProps {
  params: Promise<{ cartId: string }>;
}

export default async function ShippingPage({ params }: ShippingPageProps) {
  const { cartId } = await params;

  return (
    <main className="min-h-screen bg-white px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <BillingShippingStep cartId={cartId} />
      </div>
    </main>
  );
}
