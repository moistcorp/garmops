import { OrderReviewStep } from "@/components/configurator/cart/OrderReviewStep";

interface CartPageProps {
  params: Promise<{ cartId: string }>;
}

export default async function CartPage({ params }: CartPageProps) {
  const { cartId } = await params;

  return (
    <main className="min-h-screen bg-white px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <OrderReviewStep cartId={cartId} />
      </div>
    </main>
  );
}
