import type { ProductId } from "@/lib/configurator/pricing";
import { ConfiguratorJourney } from "@/components/configurator/ConfiguratorJourney";

type CheckoutStepId = "summary" | "shipping" | "payment";

interface CheckoutStepsProps {
  currentStep: CheckoutStepId;
  cartId: string;
  firstProductId?: ProductId;
  firstItemId?: string;
}

export function CheckoutSteps({
  currentStep,
  cartId,
  firstProductId,
  firstItemId,
}: CheckoutStepsProps) {
  const journeyStep = currentStep === "summary" ? "quantity" : currentStep === "shipping" ? "company" : "review";
  const customiseHref = firstProductId && firstItemId
    ? `/configurator/build/${encodeURIComponent(firstProductId)}?cartId=${encodeURIComponent(cartId)}&itemId=${encodeURIComponent(firstItemId)}`
    : "/configurator";

  return (
    <ConfiguratorJourney
      currentStep={journeyStep}
      links={{
        product: "/configurator",
        customise: customiseHref,
        quantity: `/configurator/cart/${encodeURIComponent(cartId)}/review`,
        company: `/configurator/cart/${encodeURIComponent(cartId)}/shipping`,
      }}
    />
  );
}
