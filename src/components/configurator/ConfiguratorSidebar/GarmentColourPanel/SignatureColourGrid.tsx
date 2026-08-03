"use client";

import type { SignatureColour } from "@/lib/configurator/colourRules";

interface SignatureColourGridProps {
  colours: SignatureColour[];
  selectedName: string;
  onSelect: (colour: SignatureColour) => void;
}

export default function SignatureColourGrid({
  colours,
  selectedName,
  onSelect,
}: SignatureColourGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 pt-3">
      {colours.map((colour) => {
        const isActive = colour.name.toLowerCase() === selectedName.toLowerCase();
        return (
          <button
            key={colour.name}
            type="button"
            onClick={() => onSelect(colour)}
            aria-pressed={isActive}
            className={`group relative flex items-center gap-2 rounded-[4px] border px-2 py-1.5 text-left text-sm transition-colors ${
              isActive
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/6"
                : "techpack-control border hover:!border-[var(--color-accent)]/35 hover:!bg-white/55"
            }`}
          >
            <span
              className="h-8 w-8 shrink-0 rounded-[4px] border border-[var(--color-rule)]"
              style={{ backgroundColor: colour.hex }}
              aria-hidden="true"
            />
            <span className="min-w-0 truncate">
              <span className="block truncate text-xs">{colour.name}</span>
              <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.04em] text-[var(--text-primary)]/45">
                {colour.hex}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
