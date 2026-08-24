"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Download, LoaderCircle } from "lucide-react";
import GarmopsLogo from "@/components/common/GarmopsLogo";
import { formatSpecCode } from "@/lib/orders/format";
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
  isToteProduct?: boolean;
  compact?: boolean;
  condensed?: boolean;
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
  isToteProduct = false,
  compact = false,
  condensed = false,
  className = "",
}: ConfiguratorJourneyProps) {
  const steps = isToteProduct
    ? STEPS.map((step) => step.id === "neck-label" ? { ...step, label: "Bag Label" } : step)
    : STEPS;
  const currentIndex = Math.max(0, steps.findIndex((step) => step.id === currentStep));
  const previousStep = currentIndex > 0 ? steps[currentIndex - 1] : undefined;
  const previousStepHandler = previousStep ? onStepSelect[previousStep.id] : undefined;
  const previousStepHref = previousStep ? links[previousStep.id] ?? backHref : backHref;
  const progressPercent = (currentIndex / (steps.length - 1)) * 100;
  const specCode = specReference ? formatSpecCode(specReference) : null;
  const backButtonClass =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-(--color-rule) bg-(--color-cream) text-(--color-navy) transition-colors hover:border-(--color-accent) hover:text-(--color-accent)";

  return (
    <>
      <nav
        aria-label="Configurator progress"
        className={`border border-(--color-rule) bg-(--color-cream) ${
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
                {(previousStepHandler || previousStepHref) && <span className="hidden font-mono text-xs uppercase tracking-[0.06em] text-(--text-primary)/45 sm:inline">Back</span>}
                <div className="flex min-w-0 items-center gap-3 border-l border-(--color-rule) pl-3">
                  <Link
                    href="/"
                    aria-label="Go to Garmops homepage"
                    title="Garmops homepage"
                    className="shrink-0 rounded-xs transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--color-accent)"
                  >
                    <GarmopsLogo className="h-3.5 w-auto" />
                  </Link>
                  {productName && (
                    <>
                      <span
                        aria-hidden="true"
                        className="h-4 w-px shrink-0 bg-(--text-primary)/15"
                      />
                      <span className="hidden max-w-40 truncate text-sm font-medium text-(--text-primary)/85 sm:inline sm:max-w-64">
                        {productName}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {condensed ? (
              <div className="flex min-w-0 flex-1 items-center justify-center px-2 sm:px-6">
                <div className="flex w-full max-w-md items-center justify-center gap-1.5 sm:gap-3">
                  <span className="shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-(--color-accent)">
                    Product
                  </span>
                  <span className="font-mono text-[11px] text-(--text-primary)/45 sm:hidden" aria-hidden="true">·</span>
                  <div
                    className="hidden h-0.5 min-w-6 flex-1 overflow-hidden bg-(--color-rule) sm:block"
                    role="progressbar"
                    aria-label="Configurator progress"
                    aria-valuemin={1}
                    aria-valuemax={steps.length}
                    aria-valuenow={currentIndex + 1}
                  >
                    <span
                      className="block h-full origin-left bg-(--color-accent)"
                      style={{ transform: `scaleX(${(currentIndex + 1) / steps.length})` }}
                    />
                  </div>
                  <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.06em] text-(--text-primary)/65">
                    <span className="sm:hidden">{currentIndex + 1}/{steps.length}</span>
                    <span className="hidden sm:inline">{currentIndex + 1} of {steps.length}</span>
                  </span>
                </div>
              </div>
            ) : accountSaveNotice ? (
              <div className="flex min-w-0 flex-1 items-center justify-end">
                {accountSaveNotice}
              </div>
            ) : null}

            <div className="ml-auto flex items-center gap-3">
              {!condensed ? (
                <div className="text-right font-mono text-xs uppercase tracking-[0.06em] text-(--color-navy)">
                  {specCode && <span className="block">{specCode}</span>}
                  <span className="block text-(--text-primary)/60">
                    STEP {String(currentIndex + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
                  </span>
                </div>
              ) : null}
              {(onDownloadPdf || showCart) && (
                <div className="flex min-w-fit items-center gap-2 border-l border-(--color-rule) pl-3">
                {onDownloadPdf && (
                  <button
                    type="button"
                    onClick={onDownloadPdf}
                    disabled={isDownloadDisabled || isDownloadingPdf}
                    aria-label={
                      isDownloadingPdf ? "Creating design PDF" : "Download design PDF"
                    }
                    title={isDownloadingPdf ? "Creating design PDF" : "Download design PDF"}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-(--color-rule) bg-(--color-cream) text-(--color-accent) transition-colors hover:border-(--color-accent) hover:bg-(--color-accent) hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
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

          {!condensed ? <div className="relative mt-3 px-1 pb-0.5 sm:mt-4">
            <div aria-hidden="true" className="absolute inset-x-[6.25%] top-[10px] h-[2px] bg-(--color-rule)">
              <span
                className="techpack-progress absolute inset-y-0 left-0 block"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <ol className="relative z-10 grid grid-cols-8 gap-1" role="list">
              {steps.map((step, index) => {
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
                          ? "bg-(--color-accent)"
                          : complete
                            ? "bg-(--color-navy)"
                            : "bg-[rgba(22,33,43,0.3)]"
                      }`}
                    />
                    <span className={`mt-2 block font-mono text-xs uppercase tracking-[0.04em] ${
                      active ? "text-(--color-accent)" : complete ? "text-(--color-navy)" : "text-[rgba(22,33,43,0.5)]"
                    }`}>
                      <span className="xl:hidden">{String(index + 1).padStart(2, "0")}{active ? <span className="hidden sm:inline"> {step.label}</span> : null}</span>
                      <span className="hidden xl:inline">{String(index + 1).padStart(2, "0")} {step.label}</span>
                    </span>
                  </>
                );
                const controlClass = "block min-w-0 text-center transition-colors hover:text-(--color-accent)";
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
          </div> : null}
        </div>
      </nav>
    </>
  );
}
