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
  screen_print: "Bold graphics & repeat bulk production",
  dtf: "Detailed and multi-colour artwork",
  reflective_print: "Light-reactive speciality finish",
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
    <fieldset className="flex flex-col gap-2" aria-label={`${sideLabel} print method`}>
      <legend className="text-xs font-semibold text-[var(--text-primary)]/70">
        2 — Choose print method<span aria-hidden="true">*</span>
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
              className={`min-h-[92px] rounded-[4px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/45 ${
                selected
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/8"
                  : "techpack-control hover:!border-[var(--color-accent)]/45"
              }`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-[var(--text-primary)]/85">
                  {TECHNIQUE_LABELS[technique]}
                </span>
                <span
                  aria-hidden="true"
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border ${
                    selected
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20"
                      : "border-[var(--text-primary)]/25"
                  }`}
                />
              </span>
              <span className="mt-2 block text-xs leading-relaxed text-[var(--text-primary)]/55">
                {TECHNIQUE_DESCRIPTIONS[technique]}
              </span>
            </button>
          );
        })}
      </div>
      {!value && (
        <p className="text-xs font-medium leading-relaxed text-[#8A6212]">
          Choose a print method to unlock placement.
        </p>
      )}
      {value && (
        <p className="text-xs leading-relaxed text-[var(--text-primary)]/55">
          {value === "screen_print"
            ? "Our team will review the artwork for print preparation."
            : value === "dtf"
              ? "High-resolution artwork is preferred for detailed prints."
              : "Clean artwork generally reproduces best with this finish."}
        </p>
      )}
    </fieldset>
  );
}

export default TechniqueSelect;
