type CheckoutStepId = "summary" | "shipping" | "payment";

interface CheckoutStepsProps {
  currentStep: CheckoutStepId;
}

const CHECKOUT_STEPS: { id: CheckoutStepId; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "shipping", label: "Shipping" },
  { id: "payment", label: "Payment" },
];

export function CheckoutSteps({ currentStep }: CheckoutStepsProps) {
  const currentIndex = CHECKOUT_STEPS.findIndex((step) => step.id === currentStep);

  return (
    <nav aria-label="Checkout progress" className="rounded-lg border border-[#E5E5E5] bg-white px-4 py-3">
      <ol className="grid grid-cols-3 gap-2 text-xs font-medium text-[#111111]/50">
        {CHECKOUT_STEPS.map((step, index) => {
          const isCurrent = step.id === currentStep;
          const isComplete = index < currentIndex;

          return (
            <li key={step.id} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                  isCurrent
                    ? "border-[#111111] bg-[#111111] text-white"
                    : isComplete
                    ? "border-[#111111] text-[#111111]"
                    : "border-[#E5E5E5] text-[#111111]/45"
                }`}
              >
                {index + 1}
              </span>
              <span className={isCurrent ? "text-[#111111]" : ""}>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
