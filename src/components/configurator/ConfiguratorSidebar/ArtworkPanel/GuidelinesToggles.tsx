import { JSX, useState } from 'react';
import type { PrintAreaDimensions } from '@/lib/configurator/sizecharts';

// Matches the horizontal left-chest reference used by Assembly.
export const LEFT_CHEST_DIMENSIONS: PrintAreaDimensions = { width: 10, height: 6 };
export const LEFT_CHEST_PLACEMENT = {
  fromCenterCm: 9,
  fromNeckCm: 6,
} as const;

export interface GuidelinesTogglesProps {
  maximumArea?: boolean;
  leftChest?: boolean;
  onMaximumAreaChange?: (value: boolean) => void;
  onLeftChestChange?: (value: boolean) => void;
}

export function GuidelinesToggles(props: GuidelinesTogglesProps): JSX.Element {
  const maxAreaControlled = props.maximumArea !== undefined;
  const leftChestControlled = props.leftChest !== undefined;

  const [internalMaxArea, setInternalMaxArea] = useState<boolean>(
    props.maximumArea ?? true
  );
  const [internalLeftChest, setInternalLeftChest] = useState<boolean>(
    props.leftChest ?? false
  );

  const maximumArea = maxAreaControlled ? (props.maximumArea as boolean) : internalMaxArea;
  const leftChest = leftChestControlled ? (props.leftChest as boolean) : internalLeftChest;

  const toggleMaxArea = () => {
    const next = !maximumArea;
    if (!maxAreaControlled) setInternalMaxArea(next);
    props.onMaximumAreaChange?.(next);
  };

  const toggleLeftChest = () => {
    const next = !leftChest;
    if (!leftChestControlled) setInternalLeftChest(next);
    props.onLeftChestChange?.(next);
  };

  return (
    <div className="flex flex-col gap-2" aria-label="Artwork guidelines">
      <button
        type="button"
        role="switch"
        aria-checked={maximumArea}
        onClick={toggleMaxArea}
        className="techpack-control flex w-full items-center justify-between gap-4 rounded-[4px] border px-3 py-2.5 text-left"
      >
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-[var(--text-primary)]/80">
            Maximum area
          </span>
          <span className="block text-[11px] text-[var(--text-primary)]/45">
            Show the selected size boundary
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`relative h-6 w-11 shrink-0 rounded-[4px] p-0.5 transition-colors ${
            maximumArea ? "bg-[var(--color-accent)]" : "bg-[var(--text-primary)]/15"
          }`}
        >
          <span
            className={`block h-5 w-5 rounded-[4px] bg-white  transition-transform ${
              maximumArea ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </span>
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={leftChest}
        onClick={toggleLeftChest}
        className="techpack-control flex w-full items-center justify-between gap-4 rounded-[4px] border px-3 py-2.5 text-left"
      >
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-[var(--text-primary)]/80">
            Left chest
          </span>
          <span className="block text-[11px] text-[var(--text-primary)]/45">
            Show the left-chest reference
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`relative h-6 w-11 shrink-0 rounded-[4px] p-0.5 transition-colors ${
            leftChest ? "bg-[var(--color-accent)]" : "bg-[var(--text-primary)]/15"
          }`}
        >
          <span
            className={`block h-5 w-5 rounded-[4px] bg-white  transition-transform ${
              leftChest ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </span>
      </button>
    </div>
  );
}
