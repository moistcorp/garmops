"use client";

import type { SignatureColour } from "@/lib/configurator/colours";

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
            className={`group relative flex items-center gap-2 rounded-full border px-2 py-1.5 text-left text-sm transition-colors ${
              isActive
                ? "border-[var(--color-teal)] bg-white/60 shadow-sm backdrop-blur-lg"
                : "configurator-glass-control border hover:!border-[var(--color-teal)]/35 hover:!bg-white/55"
            }`}
          >
            <span
              className="h-6 w-6 shrink-0 rounded-full border border-[#E5E5E5]"
              style={{ backgroundColor: colour.hex }}
              aria-hidden="true"
            />
            <span className="truncate">{colour.name}</span>
          </button>
        );
      })}
    </div>
  );
}
