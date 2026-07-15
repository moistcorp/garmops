"use client";

import type { ArtworkTechnique } from "@/lib/configurator/types/configurator";

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
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1 text-sm text-[#111111]">
        Technique
        <select
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value as ArtworkTechnique)}
        >
          <option value="" disabled>
            Select a technique
          </option>
          {TECHNIQUE_ORDER.map((technique) => (
            <option key={technique} value={technique}>
              {TECHNIQUE_LABELS[technique]}
            </option>
          ))}
        </select>
      </label>
      {/* TODO: real Techniques Guide URL not provided in Phase 6B spec — placeholder href */}
      <a
        href="#techniques-guide"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs underline text-[#111111]"
      >
        Techniques Guide
      </a>
    </div>
  );
}

export default TechniqueSelect;