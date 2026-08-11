"use client";

import type { ArtworkFileType, CustomerArtworkTechnique } from "@/lib/configurator/types/configurator";
import { CUSTOMER_PRINT_TECHNIQUE_LABELS } from "@/lib/pricingRules";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";

export interface TechniqueSelectProps {
  value?: CustomerArtworkTechnique;
  fileType?: ArtworkFileType;
  side?: "front" | "back";
  onChange: (technique: CustomerArtworkTechnique) => void;
}

export const TECHNIQUE_LABELS = CUSTOMER_PRINT_TECHNIQUE_LABELS;

const TECHNIQUE_ORDER: CustomerArtworkTechnique[] = [
  "screen_print",
  "dtf",
  "reflective_print",
];

const TECHNIQUE_DESCRIPTIONS: Record<CustomerArtworkTechnique, string> = {
  screen_print: "Premium, smooth finish with a soft and durable hand feel.",
  dtf: "Crisp, smooth finish with a flexible, slightly raised feel.",
  reflective_print: "Clean, slightly raised finish that becomes reflective under direct light.",
};

export function TechniqueSelect({ value, fileType, side = "front", onChange }: TechniqueSelectProps) {
  const sideLabel = side === "front" ? "Front" : "Back";

  function chooseTechnique(technique: CustomerArtworkTechnique) {
    onChange(technique);
    trackConfiguratorEvent("technique_selected", {
      technique,
      file_type: fileType ?? null,
    });
  }

  return (
    <fieldset className="flex flex-col gap-2.5 border-t border-(--color-rule) pt-4" aria-label={`${sideLabel} print method`}>
      <legend className="text-xs font-semibold text-(--text-primary)/70">
        <span className="whitespace-nowrap">2 -</span> Print method<span aria-hidden="true">*</span>
      </legend>
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Print method">
        {TECHNIQUE_ORDER.map((technique) => {
          const selected = value === technique;
          return (
            <button
              key={technique}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => chooseTechnique(technique)}
              className={`flex min-h-11 items-center rounded-sm border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/45 ${
                selected
                  ? "border-(--color-accent) bg-(--color-accent)/8"
                  : "techpack-control hover:!border-(--color-accent)/45"
              }`}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="min-w-0 text-[13px] font-semibold leading-tight text-(--text-primary)/85">
                  {TECHNIQUE_LABELS[technique]}
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
      {value && (
        <p className="text-xs leading-relaxed text-(--text-primary)/58">
          <span className="font-semibold text-(--text-primary)/75">{TECHNIQUE_LABELS[value]}</span>
          <span aria-hidden="true"> · </span>
          {TECHNIQUE_DESCRIPTIONS[value]}
        </p>
      )}
    </fieldset>
  );
}

export default TechniqueSelect;
