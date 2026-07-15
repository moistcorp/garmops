import { ConfirmationStep } from "@/components/configurator/cart/ConfirmationStep";

interface ConfirmationPageProps {
  params: Promise<{ cartId: string }>;
}

export default async function ConfirmationPage({ params }: ConfirmationPageProps) {
  const { cartId } = await params;

  return (
    <main className="min-h-screen bg-white px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <ConfirmationStep cartId={cartId} />
      </div>
    </main>
  );
}
