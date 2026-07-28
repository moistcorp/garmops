import { OrderReviewStep } from "@/components/configurator/cart/OrderReviewStep";

interface CartPageProps {
  params: Promise<{ cartId: string }>;
}

export default async function CartPage({ params }: CartPageProps) {
  const { cartId } = await params;

  return (
    <main className="app-liquid-bg min-h-screen px-4 pb-8 sm:pb-10">
      <div className="mx-auto max-w-6xl">
        <OrderReviewStep cartId={cartId} />
      </div>
    </main>
  );
}
