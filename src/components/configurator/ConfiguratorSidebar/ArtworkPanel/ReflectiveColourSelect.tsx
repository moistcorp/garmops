"use client";

import type { ReflectiveColourKey } from "@/lib/configurator/reflectiveColours";
import {
  DEFAULT_REFLECTIVE_COLOUR,
  REFLECTIVE_COLOUR_OPTIONS,
} from "@/lib/configurator/reflectiveColours";

interface ReflectiveColourSelectProps {
  value?: ReflectiveColourKey;
  side: "front" | "back";
  onChange: (colour: ReflectiveColourKey) => void;
}

export default function ReflectiveColourSelect({
  value = DEFAULT_REFLECTIVE_COLOUR,
  side,
  onChange,
}: ReflectiveColourSelectProps) {
  const sideLabel = side === "front" ? "Front" : "Back";

  return (
    <fieldset
      className="flex flex-col gap-2.5 pt-1"
      aria-label={`${sideLabel} reflective colour`}
    >
      <legend className="text-xs font-semibold text-(--text-primary)/70">
        Reflective colour
      </legend>
      <p className="text-xs leading-relaxed text-(--text-primary)/50">
        Preview colour only; final material may vary slightly.
      </p>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Reflective colour">
        {REFLECTIVE_COLOUR_OPTIONS.map((option) => {
          const selected = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              onClick={() => onChange(option.key)}
              className={`flex min-h-10 items-center gap-2 rounded-sm border px-2 py-1.5 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/45 ${
                selected
                  ? "border-(--color-accent) bg-(--color-accent)/8 text-(--text-primary)"
                  : "techpack-control text-(--text-primary)/70 hover:!border-(--color-accent)/45"
              }`}
            >
              <span
                aria-hidden="true"
                className="h-4 w-4 shrink-0 rounded-full border border-black/15 ring-1 ring-white"
                style={{ backgroundColor: option.hex }}
              />
              <span className="min-w-0 leading-tight">{option.label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
