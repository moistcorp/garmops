import { OrderReviewStep } from "@/components/configurator/cart/OrderReviewStep";

interface ReviewPageProps {
  params: Promise<{ cartId: string }>;
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { cartId } = await params;

  return (
    <main className="techpack-canvas min-h-screen px-4 pb-8 sm:pb-10">
      <div className="mx-auto max-w-6xl">
        <OrderReviewStep cartId={cartId} />
      </div>
    </main>
  );
}
