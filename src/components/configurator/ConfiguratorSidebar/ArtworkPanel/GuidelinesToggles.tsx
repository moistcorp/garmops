"use client";

import type { ArtworkGuidelines } from '@/lib/configurator/types/configurator';
import type { PrintAreaDimensions } from '@/lib/configurator/sizecharts';

interface GuidelinesTogglesProps {
  value: ArtworkGuidelines;
  onChange: (next: ArtworkGuidelines) => void;
  showLeftChest?: boolean;
}

export function GuidelinesToggles({
  value,
  onChange,
  showLeftChest = true,
}: GuidelinesTogglesProps) {
  const options = [
    {
      id: 'maximumArea' as const,
      label: 'Maximum Area',
    },
    ...(showLeftChest
      ? [{
          id: 'leftChest' as const,
          label: 'Left Chest',
        }]
      : []),
  ];

  return (
    <fieldset aria-label="Preview guidelines">
      <div className="flex flex-col gap-1">
        {options.map((option) => {
          const enabled = value[option.id];
          return (
            <div key={option.id} className="flex min-h-11 items-center justify-between gap-4">
              <span className="text-xs font-medium text-(--text-primary)/70">
                {option.label}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`Show ${option.label} guideline`}
                onClick={() => onChange({ ...value, [option.id]: !enabled })}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/45 focus-visible:ring-offset-2 ${
                  enabled
                    ? 'bg-(--color-accent) hover:bg-(--color-accent-dark)'
                    : 'bg-[#DCE1E6] hover:bg-[#CDD3DA]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-[left] ${
                    enabled ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

// Matches the horizontal left-chest reference used by Assembly.
export const LEFT_CHEST_DIMENSIONS: PrintAreaDimensions = { width: 10, height: 6 };
export const LEFT_CHEST_PLACEMENT = {
  fromCenterCm: 9,
  fromNeckCm: 6,
} as const;
