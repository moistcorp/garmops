import { JSX, useState } from 'react';
import type { PrintAreaDimensions } from '@/lib/configurator/sizecharts';

// PLACEHOLDER — not specified in Appendix, needs confirmation.
// "Left Chest" is documented only as "a smaller reference box"; this is a
// commonly-used left-chest print size, not a value sourced from the ledger.
// Exported so CanvasRenderer can draw the same reference box on the live
// preview instead of only in this sidebar diagram.
export const LEFT_CHEST_DIMENSIONS: PrintAreaDimensions = { width: 10, height: 12 };

// px-per-cm scale for the illustrative overlay rendered by this component.
const PX_PER_CM = 6;

export interface GuidelinesTogglesProps {
  /** Max print-area dimensions for the currently selected artwork area size. */
  printAreaDimensions: PrintAreaDimensions;
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

  const { width: maxW, height: maxH } = props.printAreaDimensions;
  const { width: chestW, height: chestH } = LEFT_CHEST_DIMENSIONS;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-4">
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={maximumArea} onChange={toggleMaxArea} />
          Maximum Area
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={leftChest} onChange={toggleLeftChest} />
          Left Chest
        </label>
      </div>

      {(maximumArea || leftChest) && (
        <div
          className="relative border border-solid border-gray-300 bg-gray-50"
          style={{ width: maxW * PX_PER_CM, height: maxH * PX_PER_CM }}
        >
          {maximumArea && (
            <div
              className="absolute inset-0 border-2 border-dashed border-blue-500"
              aria-label="Maximum area guideline"
            />
          )}
          {leftChest && (
            <div
              className="absolute left-2 top-2 border-2 border-dashed border-amber-500"
              style={{ width: chestW * PX_PER_CM, height: chestH * PX_PER_CM }}
              aria-label="Left chest guideline"
            />
          )}
        </div>
      )}
    </div>
  );
}