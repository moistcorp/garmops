import Link from "next/link";
import { Check } from "lucide-react";
import { ConfiguratorStageTracker } from "./ConfiguratorStageTracker";

export type ConfiguratorJourneyStep =
  | "product"
  | "customise"
  | "quantity"
  | "company"
  | "review"
  | "reserve";

interface ConfiguratorJourneyProps {
  currentStep: ConfiguratorJourneyStep;
  links?: Partial<Record<ConfiguratorJourneyStep, string>>;
  compact?: boolean;
  className?: string;
}

const STEPS: Array<{
  id: ConfiguratorJourneyStep;
  label: string;
  minutesRemaining: number;
}> = [
  { id: "product", label: "Product", minutesRemaining: 8 },
  { id: "customise", label: "Customise", minutesRemaining: 6 },
  { id: "quantity", label: "Quantity", minutesRemaining: 4 },
  { id: "company", label: "Company & delivery", minutesRemaining: 3 },
  { id: "review", label: "Review", minutesRemaining: 1 },
  { id: "reserve", label: "Reserve", minutesRemaining: 0 },
];

export function ConfiguratorJourney({
  currentStep,
  links = {},
  compact = false,
  className = "",
}: ConfiguratorJourneyProps) {
  const currentIndex = Math.max(0, STEPS.findIndex((step) => step.id === currentStep));
  const current = STEPS[currentIndex];

  return (
    <>
      <ConfiguratorStageTracker stage={currentStep} />
      <nav
      aria-label="Configurator progress"
      className={`rounded-2xl border border-[#ECE7DF] bg-white shadow-[0_2px_10px_rgba(22,33,43,0.04)] ${
        compact ? "px-3 py-2" : "px-4 py-3 sm:px-5"
      } ${className}`}
    >
      <div className="mb-2 flex items-center justify-between gap-3 text-[11px] text-[#111111]/55">
        <span className="font-semibold uppercase tracking-wide">
          Step {currentIndex + 1} of {STEPS.length}
        </span>
        <span>{current.minutesRemaining > 0 ? `About ${current.minutesRemaining} min remaining` : "Final step"}</span>
      </div>
      <ol className="scrollbar-hide flex gap-2 overflow-x-auto pb-0.5" role="list">
        {STEPS.map((step, index) => {
          const complete = index < currentIndex;
          const active = index === currentIndex;
          const href = complete ? links[step.id] : undefined;
          const content = (
            <>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                  active || complete
                    ? "border-[var(--color-teal)] bg-[var(--color-teal)] text-white"
                    : "border-[#E5E5E5] bg-white text-[#111111]/40"
                }`}
              >
                {complete ? <Check size={13} strokeWidth={2.8} aria-hidden="true" /> : index + 1}
              </span>
              <span className={`whitespace-nowrap ${active ? "font-semibold text-[#111111]" : "text-[#111111]/55"}`}>
                {step.label}
              </span>
            </>
          );

          return (
            <li key={step.id} className="flex min-w-fit items-center">
              {href ? (
                <Link
                  href={href}
                  className="flex min-h-9 items-center gap-2 rounded-full px-2 hover:bg-[#F7F7F7]"
                  aria-label={`Return to ${step.label}`}
                >
                  {content}
                </Link>
              ) : (
                <div
                  aria-current={active ? "step" : undefined}
                  className="flex min-h-9 items-center gap-2 rounded-full px-2"
                >
                  {content}
                </div>
              )}
              {index < STEPS.length - 1 && (
                <span aria-hidden="true" className={`mx-1 h-px w-5 ${index < currentIndex ? "bg-[var(--color-teal)]" : "bg-[#E5E5E5]"}`} />
              )}
            </li>
          );
        })}
      </ol>
      </nav>
    </>
  );
}
