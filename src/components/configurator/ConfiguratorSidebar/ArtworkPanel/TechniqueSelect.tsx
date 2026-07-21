"use client";

import type { ArtworkTechnique } from "@/lib/configurator/types/configurator";
import { formatInr, TECHNIQUE_UNIT_PRICE_DELTAS } from "@/lib/configurator/pricing";

export interface TechniqueSelectProps {
  value?: ArtworkTechnique;
  onChange: (technique: ArtworkTechnique) => void;
}

export const TECHNIQUE_LABELS: Record<ArtworkTechnique, string> = {
  screen_print: "Screen Print",
  dtg: "DTG",
  dtf: "DTF",
  reflective_heat_transfer: "Reflective Heat Transfer",
  puff_print: "Puff Print",
  embroidery: "Embroidery",
};

const TECHNIQUE_ORDER: ArtworkTechnique[] = [
  "screen_print",
  "dtg",
  "dtf",
  "reflective_heat_transfer",
  "puff_print",
  "embroidery",
];

export function TechniqueSelect({ value, onChange }: TechniqueSelectProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[#111111]">Technique</span>
        <a
          href="/how-it-works"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-[#111111]/65 underline underline-offset-2 hover:text-[#111111]"
        >
          Techniques Guide
        </a>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {TECHNIQUE_ORDER.map((technique) => {
          const selected = value === technique;
          return (
            <button
              key={technique}
              type="button"
              onClick={() => onChange(technique)}
              aria-pressed={selected}
              className={`min-h-[58px] rounded-md border px-3 py-2 text-left transition-colors ${
                selected
                  ? "border-[#111111] bg-[#111111] text-white"
                  : "border-[#E5E5E5] bg-white text-[#111111] hover:border-[#111111]"
              }`}
            >
              <span className="block text-xs font-semibold leading-tight">
                {TECHNIQUE_LABELS[technique]}
              </span>
              <span
                className={`mt-1 block text-[11px] font-medium ${
                  selected ? "text-white/70" : "text-[#111111]/50"
                }`}
              >
                +{formatInr(TECHNIQUE_UNIT_PRICE_DELTAS[technique])}/unit
              </span>
            </button>
          );
        })}
      </div>
      {!value && (
        <p className="text-xs font-medium text-[#C47A00]">
          Choose a technique to unlock production checks and confirm artwork.
        </p>
      )}
    </div>
  );
}

export default TechniqueSelect;
