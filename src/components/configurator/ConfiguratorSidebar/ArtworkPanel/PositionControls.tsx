// src/components/configurator/ConfiguratorSidebar/ArtworkPanel/PositionControls.tsx
"use client";

import type { JSX } from "react";
import {
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Lock,
  Unlock,
  Info,
} from "lucide-react";
import {
  useArtworkPosition,
  resizeWithAspect,
  clampDim,
  constrainArtworkToPrintArea,
  getArtworkPlacementBounds,
  STEP,
  MIN_DIM,
  MAX_DIM,
  type PositionControlsState,
  type HorizontalAlign,
  type VerticalAlign,
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
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium text-neutral-600">{label}</span>
        {tooltip && (
          <span className="group relative inline-flex">
            <Info className="h-3 w-3 text-neutral-400" />
            <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 w-40 -translate-x-1/2 rounded bg-neutral-900 px-2 py-1 text-xs leading-relaxed text-white opacity-0  transition-opacity group-hover:opacity-100 z-10">
              {tooltip}
            </span>
          </span>
        )}
      </div>
      <div
        className={`techpack-control flex items-center rounded-[4px] border ${
          disabled ? "opacity-50" : ""
        }`}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(clampDim(value - STEP, min, max))}
          className="px-2 py-1 text-neutral-500 hover:text-neutral-900 disabled:cursor-not-allowed"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <input
          type="number"
          step={STEP}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            onChange(clampDim(Number.isFinite(parsed) ? parsed : min, min, max));
          }}
          className="w-14 border-x border-neutral-200 bg-transparent py-1 text-center text-sm outline-none disabled:cursor-not-allowed"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(clampDim(value + STEP, min, max))}
          className="px-2 py-1 text-neutral-500 hover:text-neutral-900 disabled:cursor-not-allowed"
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

  function setAlignH(alignH: HorizontalAlign) {
    const fromCenterCm =
      alignH === "left"
        ? bounds.minFromCenterCm
        : alignH === "right"
          ? bounds.maxFromCenterCm
          : 0;
    update({ alignH, fromCenterCm });
  }

  function setAlignV(alignV: VerticalAlign) {
    const fromNeckCm =
      alignV === "top"
        ? bounds.minFromNeckCm
        : alignV === "bottom"
          ? bounds.maxFromNeckCm
          : (bounds.minFromNeckCm + bounds.maxFromNeckCm) / 2;
    update({ alignV, fromNeckCm });
  }

  function setWidth(next: number) {
    update(resizeWithAspect(state, "width", next));
  }

  function setHeight(next: number) {
    update(resizeWithAspect(state, "height", next));
  }

  const alignHButtons: { value: HorizontalAlign; icon: typeof AlignHorizontalJustifyStart; label: string }[] = [
    { value: "left", icon: AlignHorizontalJustifyStart, label: "Align left" },
    { value: "center", icon: AlignHorizontalJustifyCenter, label: "Center horizontally" },
    { value: "right", icon: AlignHorizontalJustifyEnd, label: "Align right" },
  ];

  const alignVButtons: { value: VerticalAlign; icon: typeof AlignVerticalJustifyStart; label: string }[] = [
    { value: "top", icon: AlignVerticalJustifyStart, label: "Align top" },
    { value: "center", icon: AlignVerticalJustifyCenter, label: "Center vertically" },
    { value: "bottom", icon: AlignVerticalJustifyEnd, label: "Align bottom" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="text-xs font-medium text-neutral-600">Alignment (snaps within print area)</span>
        <div className="mt-1 flex gap-1">
          {alignHButtons.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={state.alignH === value}
              onClick={() => setAlignH(value)}
              className={`rounded-[4px] border p-1.5 ${
                state.alignH === value
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "techpack-control border text-neutral-500 hover:!bg-white/60 hover:text-neutral-900"
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <span className="mx-1 w-px bg-neutral-200" />
          {alignVButtons.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={state.alignV === value}
              onClick={() => setAlignV(value)}
              className={`rounded-[4px] border p-1.5 ${
                state.alignV === value
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "techpack-control border text-neutral-500 hover:!bg-white/60 hover:text-neutral-900"
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-2">
        <Stepper
          label="Width"
          value={state.widthCm}
          onChange={setWidth}
          min={MIN_DIM}
          max={printAreaDimensions.width}
        />
        <button
          type="button"
          onClick={() => update({ aspectLocked: !state.aspectLocked })}
          aria-label={state.aspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
          aria-pressed={state.aspectLocked}
          className={`mb-1 rounded-[4px] border p-1.5 ${
            state.aspectLocked
              ? "border-neutral-900 bg-neutral-900 text-white"
              : "techpack-control border text-neutral-500 hover:!bg-white/60 hover:text-neutral-900"
          }`}
        >
          {state.aspectLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        </button>
        <Stepper
          label="Height"
          value={state.heightCm}
          onChange={setHeight}
          min={MIN_DIM}
          max={printAreaDimensions.height}
          disabled={state.aspectLocked}
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
