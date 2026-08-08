"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Download, LoaderCircle } from "lucide-react";
import GarmopsLogo from "@/components/common/GarmopsLogo";
import { formatSpecCode } from "@/lib/orders/format";
import { ConfiguratorStageTracker } from "./ConfiguratorStageTracker";
import ProductPickerCartLink from "./products/ProductPickerCartLink";

export type ConfiguratorJourneyStep =
  | "product"
  | "colour"
  | "artwork"
  | "neck-label"
  | "quantity"
  | "delivery"
  | "review"
  | "payment";

interface ConfiguratorJourneyProps {
  currentStep: ConfiguratorJourneyStep;
  backHref?: string;
  links?: Partial<Record<ConfiguratorJourneyStep, string>>;
  onStepSelect?: Partial<Record<ConfiguratorJourneyStep, () => void>>;
  onDownloadPdf?: () => void;
  isDownloadingPdf?: boolean;
  isDownloadDisabled?: boolean;
  showCart?: boolean;
  productName?: string;
  specReference?: string;
  accountSaveNotice?: ReactNode;
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
  { id: "quantity", label: "Sizes & quantity" },
  { id: "delivery", label: "Delivery" },
  { id: "review", label: "Review" },
  { id: "payment", label: "Payment" },
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
  productName,
  specReference,
  accountSaveNotice,
  compact = false,
  className = "",
}: ConfiguratorJourneyProps) {
  const currentIndex = Math.max(0, STEPS.findIndex((step) => step.id === currentStep));
  const previousStep = currentIndex > 0 ? STEPS[currentIndex - 1] : undefined;
  const previousStepHandler = previousStep ? onStepSelect[previousStep.id] : undefined;
  const previousStepHref = previousStep ? links[previousStep.id] ?? backHref : backHref;
  const progressPercent = (currentIndex / (STEPS.length - 1)) * 100;
  const specCode = specReference ? formatSpecCode(specReference) : null;
  const backButtonClass =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-cream)] text-[var(--color-navy)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]";

  return (
    <>
      <ConfiguratorStageTracker stage={currentStep} />
      <nav
        aria-label="Configurator progress"
        className={`border border-[var(--color-rule)] bg-[var(--color-cream)] ${
          compact ? "px-3 py-2" : "px-4 py-3 sm:px-5"
        } ${className}`}
      >
        <div className="mx-auto max-w-[1600px]">
          <div className="flex min-h-9 items-center justify-between gap-3">
            {(previousStepHandler || previousStepHref || productName) && (
              <div className="flex min-w-fit items-center gap-2">
                {(previousStepHandler || previousStepHref) && (previousStepHandler ? (
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
                ))}
                {(previousStepHandler || previousStepHref) && <span className="hidden font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-primary)]/45 sm:inline">Back</span>}
                <div className="flex min-w-0 items-center gap-3 border-l border-[var(--color-rule)] pl-3">
                  <Link
                    href="/"
                    aria-label="Go to Garmops homepage"
                    title="Garmops homepage"
                    className="shrink-0 rounded-[2px] transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-accent)]"
                  >
                    <GarmopsLogo className="h-3.5 w-auto" />
                  </Link>
                  {productName && (
                    <>
                      <span
                        aria-hidden="true"
                        className="h-4 w-px shrink-0 bg-[var(--text-primary)]/15"
                      />
                      <span className="max-w-40 truncate text-sm font-medium text-[var(--text-primary)]/85 sm:max-w-64">
                        {productName}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {accountSaveNotice && (
              <div className="flex min-w-0 flex-1 items-center justify-end">
                {accountSaveNotice}
              </div>
            )}

            <div className="ml-auto flex items-center gap-3">
              <div className="text-right font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-navy)]">
                {specCode && <span className="block">{specCode}</span>}
                <span className="block text-[var(--text-primary)]/45">
                  STEP {String(currentIndex + 1).padStart(2, "0")} / 08
                </span>
              </div>
              {(onDownloadPdf || showCart) && (
                <div className="flex min-w-fit items-center gap-2 border-l border-[var(--color-rule)] pl-3">
                {onDownloadPdf && (
                  <button
                    type="button"
                    onClick={onDownloadPdf}
                    disabled={isDownloadDisabled || isDownloadingPdf}
                    aria-label={
                      isDownloadingPdf ? "Creating design PDF" : "Download design PDF"
                    }
                    title={isDownloadingPdf ? "Creating design PDF" : "Download design PDF"}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-cream)] text-[var(--color-accent)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
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
                </div>
              )}
            </div>
          </div>

          <div className="relative mt-3 px-1 pb-0.5 sm:mt-4">
            <div aria-hidden="true" className="absolute inset-x-[6.25%] top-[10px] h-[2px] bg-[var(--color-rule)]">
              <span
                className="techpack-progress absolute inset-y-0 left-0 block"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <ol className="relative z-10 grid grid-cols-8 gap-1" role="list">
              {STEPS.map((step, index) => {
                const active = index === currentIndex;
                const complete = !active && index < currentIndex;
                const selectHandler = onStepSelect[step.id];
                const href = complete ? links[step.id] : undefined;
                const content = (
                  <>
                    <span
                      aria-hidden="true"
                      className={`mx-auto block h-5 w-[2px] ${
                        active
                          ? "bg-[var(--color-accent)]"
                          : complete
                            ? "bg-[var(--color-navy)]"
                            : "bg-[rgba(22,33,43,0.3)]"
                      }`}
                    />
                    <span className={`mt-2 block font-mono text-[9px] uppercase tracking-[0.04em] ${
                      active ? "text-[var(--color-accent)]" : complete ? "text-[var(--color-navy)]" : "text-[rgba(22,33,43,0.5)]"
                    }`}>
                      <span className="sm:hidden">{String(index + 1).padStart(2, "0")}</span>
                      <span className="hidden sm:inline">{String(index + 1).padStart(2, "0")} {step.label}</span>
                    </span>
                  </>
                );
                const controlClass = "block min-w-0 text-center transition-colors hover:text-[var(--color-accent)]";
                return (
                  <li key={step.id}>
                    {complete && selectHandler ? (
                      <button type="button" onClick={selectHandler} className={controlClass} aria-label={`Return to ${step.label}`}>
                        {content}
                      </button>
                    ) : href ? (
                      <Link href={href} className={controlClass} aria-label={`Return to ${step.label}`}>
                        {content}
                      </Link>
                    ) : (
                      <div aria-current={active ? "step" : undefined} className={controlClass}>
                        {content}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </nav>
    </>
  );
}
