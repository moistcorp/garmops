import Link from "next/link";

type CheckoutStepId = "summary" | "shipping" | "payment";

interface CheckoutStepsProps {
  currentStep: CheckoutStepId;
  cartId: string;
}

const CHECKOUT_STEPS: { id: CheckoutStepId; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "shipping", label: "Shipping" },
  { id: "payment", label: "Payment" },
];

export function CheckoutSteps({ currentStep, cartId }: CheckoutStepsProps) {
  const currentIndex = CHECKOUT_STEPS.findIndex((step) => step.id === currentStep);
  const encodedCartId = encodeURIComponent(cartId);
  const hrefs: Record<CheckoutStepId, string> = {
    summary: `/configurator/cart/${encodedCartId}/review`,
    shipping: `/configurator/cart/${encodedCartId}/shipping`,
    payment: `/configurator/cart/${encodedCartId}/confirmation`,
  };
  const progress = `${(currentIndex / (CHECKOUT_STEPS.length - 1)) * 100}%`;

  return (
    <nav aria-label="Checkout progress" className="rounded-full border border-[#ECE7DF] bg-white px-5 py-3 shadow-[0_2px_10px_rgba(22,33,43,0.04)]">
      <ol className="relative grid grid-cols-3 text-xs font-medium text-[#111111]/50">
        <span
          aria-hidden="true"
          className="absolute left-[16.666%] right-[16.666%] top-3 h-0.5 bg-[#E5E5E5]"
        >
          <span
            className="block h-full bg-[var(--color-teal)] transition-[width] duration-500"
            style={{ width: progress }}
          />
        </span>
        {CHECKOUT_STEPS.map((step, index) => {
          const isCurrent = step.id === currentStep;
          const isComplete = index < currentIndex;

          return (
            <li
              key={step.id}
              className={`relative z-10 flex ${
                index === 0 ? "justify-start" : index === CHECKOUT_STEPS.length - 1 ? "justify-end" : "justify-center"
              }`}
            >
              <Link
                href={hrefs[step.id]}
                aria-current={isCurrent ? "step" : undefined}
                className="group flex items-center gap-2 rounded-full bg-white px-1"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] transition-colors ${
                    isCurrent || isComplete
                      ? "border-[var(--color-teal)] bg-[var(--color-teal)] text-white"
                      : "border-[#E5E5E5] bg-white text-[#111111]/45 group-hover:border-[var(--color-teal)]"
                  }`}
                >
                  {index + 1}
                </span>
                <span
                  className={`hidden transition-colors sm:inline ${
                    isCurrent
                      ? "font-semibold text-[#111111]"
                      : isComplete
                        ? "text-[var(--color-teal-dark)]"
                        : "group-hover:text-[#111111]"
                  }`}
                >
                  {step.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
