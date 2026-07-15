import { OrderReviewStep } from '@/components/configurator/cart/OrderReviewStep';

interface ReviewPageProps {
  params: { cartId: string };
}

export default function ReviewPage({ params }: ReviewPageProps) {
  return <OrderReviewStep cartId={params.cartId} />;
}