// src/components/configurator/ConfiguratorSidebar/ArtworkPanel/PositionControls.tsx
"use client";

import { useId, type JSX } from "react";
import { Info } from "lucide-react";
import {
  useArtworkPosition,
  clampDim,
  constrainArtworkToPrintArea,
  getArtworkPlacementBounds,
  STEP,
  MIN_DIM,
  MAX_DIM,
  type PositionControlsState,
} from "@/lib/configurator/ArtworkPositionContext";
import type { PrintAreaDimensions } from "@/lib/configurator/sizecharts";

interface StepperProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max?: number;
  tooltip?: string;
  disabled?: boolean;
}

function Stepper({ label, value, onChange, min, max = MAX_DIM, tooltip, disabled }: StepperProps) {
  const inputId = useId();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <label htmlFor={inputId} className="text-xs font-medium text-neutral-600">{label}</label>
        {tooltip && (
          <details className="group relative inline-flex">
            <summary className="list-none rounded-sm marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)" aria-label={`About ${label}`}>
              <Info className="h-3 w-3 cursor-help text-neutral-400" aria-hidden="true" />
            </summary>
            <span className="absolute bottom-full left-1/2 z-20 mb-1 w-44 -translate-x-1/2 rounded-sm bg-neutral-900 px-2 py-1.5 text-xs leading-relaxed text-white shadow-lg">
              {tooltip}
            </span>
          </details>
        )}
      </div>
      <div
        className={`techpack-control flex items-center rounded-sm border ${
          disabled ? "opacity-50" : ""
        }`}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(clampDim(value - STEP, min, max))}
          className="min-h-8 min-w-8 px-2 py-1 text-neutral-500 hover:text-neutral-900 disabled:cursor-not-allowed"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <input
          id={inputId}
          type="number"
          step={STEP}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            onChange(clampDim(Number.isFinite(parsed) ? parsed : min, min, max));
          }}
          className="h-8 w-14 border-x border-neutral-200 bg-transparent py-1 text-center text-sm outline-none focus:bg-white disabled:cursor-not-allowed"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(clampDim(value + STEP, min, max))}
          className="min-h-8 min-w-8 px-2 py-1 text-neutral-500 hover:text-neutral-900 disabled:cursor-not-allowed"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
        <span className="pr-2 text-xs text-neutral-400">cm</span>
      </div>
    </div>
  );
}

export interface PositionControlsProps {
  onDebugChange?: (state: PositionControlsState) => void;
  printAreaDimensions: PrintAreaDimensions;
  view?: "front" | "back";
}

export function PositionControls({
  onDebugChange,
  printAreaDimensions,
  view,
}: PositionControlsProps): JSX.Element {
  const { positions, activeView, updatePosition } = useArtworkPosition();
  const targetView = view ?? activeView;
  const state = positions[targetView];
  const bounds = getArtworkPlacementBounds(state, printAreaDimensions);

  function update(partial: Partial<PositionControlsState>) {
    const next = constrainArtworkToPrintArea(
      { ...state, ...partial },
      printAreaDimensions
    );
    onDebugChange?.(next);
    updatePosition(targetView, next);
  }

  function setWidth(next: number) {
    update({ widthCm: clampDim(next, MIN_DIM, printAreaDimensions.width) });
  }

  function setHeight(next: number) {
    update({ heightCm: clampDim(next, MIN_DIM, printAreaDimensions.height) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <Stepper
          label="Width"
          value={state.widthCm}
          onChange={setWidth}
          min={MIN_DIM}
          max={printAreaDimensions.width}
        />
        <Stepper
          label="Height"
          value={state.heightCm}
          onChange={setHeight}
          min={MIN_DIM}
          max={printAreaDimensions.height}
        />
      </div>

      <div className="flex gap-2">
        <Stepper
          label="From Neck"
          value={state.fromNeckCm}
          onChange={(v) => update({ fromNeckCm: v })}
          min={bounds.minFromNeckCm}
          max={bounds.maxFromNeckCm}
          tooltip="Distance from the collar seam to the top edge of the artwork."
        />
        <Stepper
          label="From Center"
          value={state.fromCenterCm}
          onChange={(v) => update({ fromCenterCm: v })}
          min={bounds.minFromCenterCm}
          max={bounds.maxFromCenterCm}
          tooltip="Signed horizontal distance from the garment centre. Negative values move left; positive values move right."
        />
      </div>
    </div>
  );
}
