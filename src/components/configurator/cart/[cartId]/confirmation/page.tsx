import { ConfirmationStep } from "@/components/configurator/cart/ConfirmationStep";

export default function ConfirmationPage({
  params,
}: {
  params: { cartId: string };
}) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-xl font-medium text-[#111111] mb-6">
        Complete Your Order
      </h1>
      <ConfirmationStep cartId={params.cartId} />
    </main>
  );
}