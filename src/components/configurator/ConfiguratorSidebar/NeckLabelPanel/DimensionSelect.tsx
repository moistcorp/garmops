"use client";

import type { NeckLabelDimensions } from "@/lib/configurator/types/configurator";

export interface DimensionSelectProps {
  value: NeckLabelDimensions | null;
  onChange: (dimensions: NeckLabelDimensions) => void;
}

interface DimensionPreset {
  id: NeckLabelDimensions;
  label: string;
}

// Position/Stitch options are identical across all 4 presets per Appendix §6,
// so no per-preset metadata beyond id/label is needed here.
const PRESETS: DimensionPreset[] = [
  { id: "50x18", label: "50 × 18 mm" },
  { id: "60x20", label: "60 × 20 mm" },
  { id: "65x15", label: "65 × 15 mm" },
  { id: "45x45", label: "45 × 45 mm" },
];

export default function DimensionSelect({ value, onChange }: DimensionSelectProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {PRESETS.map((preset) => {
        const isSelected = preset.id === value;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
            aria-pressed={isSelected}
            className={`flex min-h-[72px] items-center justify-center rounded-md px-2 text-xs font-bold transition-colors ${
              isSelected
                ? "border border-[var(--color-teal)] bg-white/60 text-[#111111] shadow-sm backdrop-blur-lg"
                : "configurator-glass-control border text-[#111111]/55 hover:!bg-white/60 hover:text-[#111111]"
            }`}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
