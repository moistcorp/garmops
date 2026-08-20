"use client";

import type { CustomerArtworkTechnique } from "@/lib/configurator/types/configurator";
import { CUSTOMER_PRINT_TECHNIQUE_LABELS } from "@/lib/pricingRules";
import { CUSTOMER_PRINT_TECHNIQUE_UNIT_DELTAS } from "@/lib/pricingRules";
import { formatInr } from "@/lib/configurator/pricing";

export interface TechniqueSelectProps {
  value?: CustomerArtworkTechnique;
  side?: "front" | "back";
  onChange: (technique: CustomerArtworkTechnique) => void;
  recommendedTechnique?: CustomerArtworkTechnique;
}

export const TECHNIQUE_LABELS = CUSTOMER_PRINT_TECHNIQUE_LABELS;

const TECHNIQUE_ORDER: CustomerArtworkTechnique[] = [
  "screen_print",
  "dtf",
  "reflective_print",
];

const TECHNIQUE_DESCRIPTIONS: Record<CustomerArtworkTechnique, string> = {
  screen_print: "Best for bold logos and 1–4 flat colours. Durable and cost-effective at scale.",
  dtf: "Best for gradients, photos and detailed multi-colour artwork.",
  reflective_print: "Best when visibility is the priority. Available in selected reflective colours.",
};

export function TechniqueSelect({ value, side = "front", onChange, recommendedTechnique }: TechniqueSelectProps) {
  const sideLabel = side === "front" ? "Front" : "Back";

  function chooseTechnique(technique: CustomerArtworkTechnique) {
    onChange(technique);
  }

  return (
    <fieldset className="flex flex-col gap-2.5 pt-4" aria-label={`${sideLabel} print method`}>
      <legend className="text-xs font-semibold text-(--text-primary)/70">
        <span className="whitespace-nowrap">2 -</span> Print method
      </legend>
      {recommendedTechnique ? <p className="text-xs leading-relaxed text-(--text-primary)/58"><span className="font-semibold text-(--color-accent-dark)">Recommended:</span> {TECHNIQUE_LABELS[recommendedTechnique]} based on the uploaded artwork.</p> : null}
      <div className="grid gap-2" role="radiogroup" aria-label="Print method">
        {TECHNIQUE_ORDER.map((technique) => {
          const selected = value === technique;
          return (
            <button
              key={technique}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => chooseTechnique(technique)}
              className={`flex min-h-14 items-center rounded-sm border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/45 ${
                selected
                  ? "border-(--color-accent) bg-(--color-accent)/8"
                  : "techpack-control hover:!border-(--color-accent)/45"
              }`}
            >
              <span className="flex w-full items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold leading-tight text-(--text-primary)/85">{TECHNIQUE_LABELS[technique]}{recommendedTechnique === technique ? <span className="rounded-sm bg-(--color-accent)/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-(--color-accent-dark)">Recommended</span> : null}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-(--text-primary)/50">{TECHNIQUE_DESCRIPTIONS[technique]} · +{formatInr(CUSTOMER_PRINT_TECHNIQUE_UNIT_DELTAS[technique])}/unit</span>
                </span>
                <span
                  aria-hidden="true"
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border ${
                    selected
                      ? "border-(--color-accent) bg-(--color-accent) ring-2 ring-(--color-accent)/20"
                      : "border-(--text-primary)/25"
                  }`}
                />
              </span>
            </button>
          );
        })}
      </div>
      {!value && (
        <p className="text-xs leading-relaxed text-(--text-primary)/50">
          Choose a print method to continue.
        </p>
      )}
    </fieldset>
  );
}

export default TechniqueSelect;
