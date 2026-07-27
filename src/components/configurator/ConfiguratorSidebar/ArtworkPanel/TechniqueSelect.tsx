"use client";

import { Sparkles } from "lucide-react";
import type {
  ArtworkFileType,
  ArtworkTechnique,
} from "@/lib/configurator/types/configurator";
import { formatInr, TECHNIQUE_UNIT_PRICE_DELTAS } from "@/lib/configurator/pricing";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";

export interface TechniqueSelectProps {
  value?: ArtworkTechnique;
  fileType?: ArtworkFileType;
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

export function getRecommendedTechnique(fileType?: ArtworkFileType): ArtworkTechnique {
  return fileType === "svg" || fileType === "ai" ? "screen_print" : "dtf";
}

function recommendationReason(fileType?: ArtworkFileType): string {
  return fileType === "svg" || fileType === "ai"
    ? "Best-value starting point for clean vector logos. Our team will verify colour count and finish."
    : "Works well with uploaded PNG/JPG artwork and does not require you to convert the file first.";
}

export function TechniqueSelect({ value, fileType, onChange }: TechniqueSelectProps) {
  const recommendation = getRecommendedTechnique(fileType);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[#111111]">Production technique</span>
        <a
          href="/how-it-works"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-[#111111]/65 underline underline-offset-2 hover:text-[#111111]"
        >
          Techniques guide
        </a>
      </div>

      <button
        type="button"
        onClick={() => { onChange(recommendation); trackConfiguratorEvent("technique_recommended", { technique: recommendation, file_type: fileType ?? null }); }}
        className="configurator-glass-subtle flex items-start gap-2 rounded-xl !border-[var(--color-teal)]/25 !bg-[var(--color-teal)]/8 px-3 py-2.5 text-left hover:!border-[var(--color-teal)]/50"
      >
        <Sparkles size={16} strokeWidth={2.2} className="mt-0.5 shrink-0 text-[var(--color-teal)]" />
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-[#111111]">
            Recommend for me: {TECHNIQUE_LABELS[recommendation]}
          </span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-[#111111]/55">
            {recommendationReason(fileType)}
          </span>
        </span>
      </button>

      <div className="grid grid-cols-2 gap-2">
        {TECHNIQUE_ORDER.map((technique) => {
          const selected = value === technique;
          return (
            <button
              key={technique}
              type="button"
              onClick={() => { onChange(technique); trackConfiguratorEvent("technique_selected", { technique, file_type: fileType ?? null }); }}
              aria-pressed={selected}
              className={`min-h-[58px] rounded-md border px-3 py-2 text-left transition-colors ${
                selected
                  ? "border-[var(--color-teal)] bg-[var(--color-teal)] text-white"
                  : "configurator-glass-control border text-[#111111] hover:!border-[var(--color-teal)]/45 hover:!bg-white/60"
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
        <p className="text-xs font-medium text-[#8A6212]">
          Choose a technique or use our recommendation. The production team will verify it before the final invoice.
        </p>
      )}
    </div>
  );
}

export default TechniqueSelect;
