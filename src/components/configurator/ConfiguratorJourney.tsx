"use client";

import Link from "next/link";
import { ArrowLeft, Check, Download, LoaderCircle } from "lucide-react";
import { ConfiguratorStageTracker } from "./ConfiguratorStageTracker";
import ProductPickerCartLink from "./products/ProductPickerCartLink";

export type ConfiguratorJourneyStep =
  | "product"
  | "colour"
  | "artwork"
  | "neck-label"
  | "quantity"
  | "company"
  | "review"
  | "reserve";

interface ConfiguratorJourneyProps {
  currentStep: ConfiguratorJourneyStep;
  backHref?: string;
  links?: Partial<Record<ConfiguratorJourneyStep, string>>;
  onStepSelect?: Partial<Record<ConfiguratorJourneyStep, () => void>>;
  onDownloadPdf?: () => void;
  isDownloadingPdf?: boolean;
  isDownloadDisabled?: boolean;
  showCart?: boolean;
  compact?: boolean;
  className?: string;
}

const STEPS: Array<{
  id: ConfiguratorJourneyStep;
  label: string;
}> = [
  { id: "product", label: "Product" },
  { id: "colour", label: "Colour" },
  { id: "artwork", label: "Artwork" },
  { id: "neck-label", label: "Neck Label" },
  { id: "quantity", label: "Summary" },
  { id: "company", label: "Delivery" },
  { id: "review", label: "Review" },
  { id: "reserve", label: "Reserve" },
];

export function ConfiguratorJourney({
  currentStep,
  backHref,
  links = {},
  onStepSelect = {},
  onDownloadPdf,
  isDownloadingPdf = false,
  isDownloadDisabled = false,
  showCart = false,
  compact = false,
  className = "",
}: ConfiguratorJourneyProps) {
  const currentIndex = Math.max(0, STEPS.findIndex((step) => step.id === currentStep));
  const previousStep = currentIndex > 0 ? STEPS[currentIndex - 1] : undefined;
  const previousStepHandler = previousStep ? onStepSelect[previousStep.id] : undefined;
  const previousStepHref = previousStep ? links[previousStep.id] ?? backHref : backHref;
  const backButtonClass =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/40 text-[#111111]/80 shadow-[0_3px_10px_rgba(22,33,43,0.09),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl transition-colors hover:border-[var(--color-teal)]/45 hover:bg-white/60 hover:text-[var(--color-teal)]";

  return (
    <>
      <ConfiguratorStageTracker stage={currentStep} />
      <nav
        aria-label="Configurator progress"
        className={`rounded-2xl border border-[#ECE7DF] bg-white shadow-[0_2px_10px_rgba(22,33,43,0.04)] ${
          compact ? "px-3 py-2" : "px-4 py-3 sm:px-5"
        } ${className}`}
      >
        <div className="scrollbar-hide mx-auto max-w-[1600px] overflow-x-auto pb-0.5">
          <ol className="mx-auto flex w-max min-w-full justify-center gap-2" role="list">
            {(previousStepHandler || previousStepHref) && (
              <li className="flex min-w-fit items-center pr-1">
                {previousStepHandler ? (
                  <button
                    type="button"
                    onClick={previousStepHandler}
                    aria-label={`Go back to ${previousStep?.label}`}
                    className={backButtonClass}
                  >
                    <ArrowLeft size={17} strokeWidth={2} aria-hidden="true" />
                  </button>
                ) : (
                  <Link
                    href={previousStepHref!}
                    aria-label={
                      previousStep ? `Go back to ${previousStep.label}` : "Go back"
                    }
                    className={backButtonClass}
                  >
                    <ArrowLeft size={17} strokeWidth={2} aria-hidden="true" />
                  </Link>
                )}
              </li>
            )}

            {STEPS.map((step, index) => {
              const active = index === currentIndex;
              const selectHandler = onStepSelect[step.id];
              const complete = !active && (index < currentIndex || Boolean(selectHandler));
              const href = complete ? links[step.id] : undefined;
              const content = (
                <>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold shadow-[0_2px_7px_rgba(22,33,43,0.08),inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-md ${
                      active || complete
                        ? "border-white/45 bg-[var(--color-teal)]/90 text-white"
                        : "border-white/75 bg-white/40 text-[#111111]/45"
                    }`}
                  >
                    {complete ? <Check size={13} strokeWidth={2.8} aria-hidden="true" /> : index + 1}
                  </span>
                  <span
                    className={`whitespace-nowrap ${
                      active ? "font-semibold text-[#111111]" : "text-[#111111]/55"
                    }`}
                  >
                    {step.label}
                  </span>
                </>
              );

              return (
                <li key={step.id} className="flex min-w-fit items-center">
                  {complete && selectHandler ? (
                    <button
                      type="button"
                      onClick={selectHandler}
                      className="flex min-h-9 items-center gap-2 rounded-full px-2 hover:bg-white/35"
                      aria-label={`Return to ${step.label}`}
                    >
                      {content}
                    </button>
                  ) : href ? (
                    <Link
                      href={href}
                      className="flex min-h-9 items-center gap-2 rounded-full px-2 hover:bg-white/35"
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
                    <span
                      aria-hidden="true"
                      className={`mx-1 h-px w-5 ${
                        index < currentIndex
                          ? "configurator-progress-teal bg-[var(--color-teal)]"
                          : "bg-[#E5E5E5]"
                      }`}
                    />
                  )}
                </li>
              );
            })}

            {(onDownloadPdf || showCart) && (
              <li className="flex min-w-fit items-center gap-2 pl-1">
                {onDownloadPdf && (
                  <button
                    type="button"
                    onClick={onDownloadPdf}
                    disabled={isDownloadDisabled || isDownloadingPdf}
                    aria-label={
                      isDownloadingPdf ? "Creating design PDF" : "Download design PDF"
                    }
                    title={isDownloadingPdf ? "Creating design PDF" : "Download design PDF"}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/40 text-[var(--color-teal-dark)] shadow-[0_3px_10px_rgba(22,33,43,0.09),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl transition-colors hover:border-[var(--color-teal)]/45 hover:bg-[var(--color-teal)]/85 hover:text-white disabled:cursor-not-allowed disabled:border-white/45 disabled:bg-white/20 disabled:text-[#111111]/30"
                  >
                    {isDownloadingPdf ? (
                      <LoaderCircle
                        size={16}
                        strokeWidth={2.2}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Download size={16} strokeWidth={2.2} aria-hidden="true" />
                    )}
                  </button>
                )}
                {showCart && <ProductPickerCartLink />}
              </li>
            )}
          </ol>
        </div>
      </nav>
    </>
  );
}
