import { ConfirmationStep } from "@/components/configurator/cart/ConfirmationStep";

interface ConfirmationPageProps {
  params: Promise<{ cartId: string }>;
}

export default async function ConfirmationPage({ params }: ConfirmationPageProps) {
  const { cartId } = await params;

  return (
    <main className="app-liquid-bg min-h-screen px-4 pb-8 sm:pb-10">
      <div className="mx-auto max-w-6xl">
        <ConfirmationStep cartId={cartId} />
      </div>
    </main>
  );
}
