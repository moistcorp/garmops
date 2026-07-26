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
              <div
                aria-current={isCurrent ? "step" : undefined}
                className="flex cursor-default items-center gap-2 rounded-full bg-white px-1"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                    isCurrent || isComplete
                      ? "border-[var(--color-teal)] bg-[var(--color-teal)] text-white"
                      : "border-[#E5E5E5] bg-white text-[#111111]/45"
                  }`}
                >
                  {index + 1}
                </span>
                <span
                  className={`hidden sm:inline ${
                    isCurrent
                      ? "font-semibold text-[#111111]"
                      : isComplete
                        ? "text-[var(--color-teal-dark)]"
                        : ""
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
