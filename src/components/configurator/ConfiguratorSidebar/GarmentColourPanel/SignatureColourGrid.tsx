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
  if (colours.length === 0) {
    return (
      <p className="rounded-[4px] border border-dashed border-[var(--color-rule)] px-3 py-4 text-sm text-[var(--text-primary)]/60">
        Colour options are currently unavailable for this product.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {colours.map((colour) => {
        const isActive = colour.name.toLowerCase() === selectedName.toLowerCase();
        return (
          <button
            key={colour.name}
            type="button"
            onClick={() => onSelect(colour)}
            aria-pressed={isActive}
            aria-label={`Select ${colour.name}`}
            className={`group relative flex min-h-24 flex-col items-stretch gap-2 rounded-[4px] border p-2 text-left text-sm transition-colors ${
              isActive
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/6 ring-2 ring-[var(--color-accent)]/25"
                : "techpack-control border hover:!border-[var(--color-accent)]/35 hover:!bg-white/55"
            }`}
          >
            <span
              className="h-12 w-full shrink-0 rounded-[4px] border border-[var(--color-rule)]"
              style={{ backgroundColor: colour.hex }}
              aria-hidden="true"
            />
            <span className="flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs font-medium">{colour.name}</span>
              {isActive ? (
                <span className="shrink-0 rounded-full bg-[var(--color-accent)] px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-[0.04em] text-white">
                  Selected
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
