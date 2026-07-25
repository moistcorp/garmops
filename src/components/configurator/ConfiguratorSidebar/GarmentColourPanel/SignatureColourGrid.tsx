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
    <div className="grid max-h-72 grid-cols-2 gap-3 overflow-y-auto pr-1 pt-3">
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
                ? "border-[var(--color-teal)] bg-white"
                : "border-[#E5E5E5] bg-transparent hover:bg-[#E5E5E5]/40"
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
