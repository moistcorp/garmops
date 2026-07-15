import { BillingShippingStep } from "@/components/configurator/cart/BillingShippingStep";

export default function ShippingPage({
  params,
}: {
  params: { cartId: string };
}) {
  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <BillingShippingStep cartId={params.cartId} />
    </main>
  );
}