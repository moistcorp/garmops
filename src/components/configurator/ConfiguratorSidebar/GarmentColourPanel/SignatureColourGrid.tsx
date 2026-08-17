"use client";

import type { SignatureColour } from "@/lib/configurator/colourRules";

interface SignatureColourGridProps {
  colours: readonly SignatureColour[];
  selectedId?: string;
  onSelect: (colour: SignatureColour) => void;
}

export default function SignatureColourGrid({
  colours,
  selectedId,
  onSelect,
}: SignatureColourGridProps) {
  if (colours.length === 0) {
    return (
      <p className="rounded-sm border border-dashed border-(--color-rule) px-3 py-4 text-sm text-(--text-primary)/60">
        Colour options are currently unavailable for this product.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {colours.map((colour) => {
        const isActive = colour.id === selectedId;
        return (
          <button
            key={colour.name}
            type="button"
            onClick={() => onSelect(colour)}
            aria-pressed={isActive}
            aria-label={`Select ${colour.name}`}
            className={`group relative flex min-h-24 flex-col items-stretch gap-2 rounded-sm border p-2 text-left text-sm transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out motion-safe:active:scale-[0.98] ${
              isActive
                ? "border-(--color-accent) bg-(--color-accent)/6 ring-2 ring-(--color-accent)/25"
                : "techpack-control border hover:!border-(--color-accent)/35 hover:!bg-white/55"
            }`}
          >
            <span
              className="h-12 w-full shrink-0 rounded-sm border border-(--color-rule)"
              style={{ backgroundColor: colour.hex }}
              aria-hidden="true"
            />
            <span className="flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs font-medium">{colour.name}</span>
              {isActive ? (
                <span className="shrink-0 rounded-full bg-(--color-accent) px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-[0.04em] text-white">
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
