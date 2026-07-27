"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Redo2, RotateCcw, Trash2, Undo2, X } from "lucide-react";
import GarmentColourPanel from "./GarmentColourPanel/GarmentColourPanel";
import ArtworkPanel from "./ArtworkPanel/ArtworkPanel";
import NeckLabelPanel from "./NeckLabelPanel/NeckLabelPanel";
import type { GarmentColour, Artwork, NeckLabel } from "@/lib/configurator/types/configurator";
import { SIGNATURE_COLOURS } from "@/lib/configurator/colours";
import { revokeArtworkObjectUrls, revokeNeckLabelObjectUrl } from "@/lib/configurator/objectUrls";
import type { GarmentView } from "@/lib/configurator/types/garment";

export type AccordionStepId = "garment-colour" | "artwork" | "neck-label";

export interface AccordionStepState {
  id: AccordionStepId;
  title: string;
  summary: string | null;
  confirmed: boolean;
  skipped?: boolean;
}

export interface ConfiguratorSidebarProps {
  expandedStepId?: AccordionStepId | null;
  onExpandedStepChange?: (id: AccordionStepId | null) => void;
  selectedColour?: GarmentColour;
  onColourChange?: (colour: GarmentColour) => void;
  steps?: AccordionStepState[];
  onStepsChange?: (steps: AccordionStepState[]) => void;
  artwork?: Artwork;
  onArtworkChange?: (artwork: Artwork) => void;
  neckLabel?: NeckLabel;
  onNeckLabelChange?: (neckLabel: NeckLabel) => void;
  activeView?: GarmentView;
  onViewChange?: (view: GarmentView) => void;
  unitBasePrice?: number;
  onAttemptStepChange?: (id: AccordionStepId | null) => void;
  isToteProduct?: boolean;
  onResetStep?: (id: AccordionStepId) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onResetAll?: () => void;
}

export const INITIAL_STEPS: AccordionStepState[] = [
  { id: "garment-colour", title: "Garment Colour", summary: null, confirmed: false },
  { id: "artwork", title: "Artwork", summary: null, confirmed: false, skipped: false },
  { id: "neck-label", title: "Neck Label", summary: null, confirmed: false, skipped: false },
];

const DEFAULT_SIGNATURE_COLOUR =
  SIGNATURE_COLOURS.find((colour) => colour.name === "Bright White") ?? SIGNATURE_COLOURS[0];

export const DEFAULT_COLOUR: GarmentColour = {
  type: "signature",
  name: DEFAULT_SIGNATURE_COLOUR.name,
  hex: DEFAULT_SIGNATURE_COLOUR.hex,
  confirmed: false,
};

export function ConfiguratorSidebar({
  expandedStepId: controlledExpandedStepId,
  onExpandedStepChange,
  selectedColour,
  onColourChange,
  steps: controlledSteps,
  onStepsChange,
  artwork: controlledArtwork,
  onArtworkChange,
  neckLabel: controlledNeckLabel,
  onNeckLabelChange,
  activeView,
  onViewChange,
  unitBasePrice,
  onAttemptStepChange,
  isToteProduct = false,
  onResetStep,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onResetAll,
}: ConfiguratorSidebarProps = {}) {
  const [internalSteps, setInternalSteps] = useState<AccordionStepState[]>(INITIAL_STEPS);
  const steps = controlledSteps ?? internalSteps;
  const [internalColour, setInternalColour] = useState<GarmentColour>(DEFAULT_COLOUR);
  const colour = selectedColour ?? internalColour;
  const [internalArtwork, setInternalArtwork] = useState<Artwork>({});
  const artwork = controlledArtwork ?? internalArtwork;
  const [internalNeckLabel, setInternalNeckLabel] = useState<NeckLabel | undefined>(undefined);
  const neckLabel = controlledNeckLabel ?? internalNeckLabel;
  const [internalExpandedStepId, setInternalExpandedStepId] = useState<AccordionStepId | null>(
    "garment-colour"
  );
  const expandedStepId =
    controlledExpandedStepId !== undefined ? controlledExpandedStepId : internalExpandedStepId;
  const activeStepIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === expandedStepId)
  );
  const activeStep = steps[activeStepIndex] ?? INITIAL_STEPS[0];
  const [confirmingReset, setConfirmingReset] = useState(false);
  const cancelResetButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmingReset) cancelResetButtonRef.current?.focus();
  }, [confirmingReset]);

  function updateSteps(updater: (current: AccordionStepState[]) => AccordionStepState[]) {
    const next = updater(steps);
    if (controlledSteps === undefined) setInternalSteps(next);
    onStepsChange?.(next);
  }

  function selectStep(id: AccordionStepId) {
    setConfirmingReset(false);
    if (id === activeStep.id) return;
    if (onAttemptStepChange) {
      onAttemptStepChange(id);
      return;
    }
    if (controlledExpandedStepId === undefined) setInternalExpandedStepId(id);
    onExpandedStepChange?.(id);
  }

  function resetStep(id: AccordionStepId) {
    if (id === "artwork") {
      if (controlledArtwork === undefined) {
        revokeArtworkObjectUrls(artwork);
        setInternalArtwork({});
      }
    }
    if (id === "neck-label") {
      if (controlledNeckLabel === undefined) {
        revokeNeckLabelObjectUrl(neckLabel);
        setInternalNeckLabel(undefined);
      }
    }
    onResetStep?.(id);
    updateSteps((current) =>
      current.map((step) =>
        step.id === id
          ? { ...step, summary: null, confirmed: false, skipped: false }
          : step
      )
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <div className="flex items-center gap-3 border-b border-[#ECE7DF] px-4 py-2.5">
        {activeStepIndex > 0 && (
          <button
            type="button"
            onClick={() => selectStep(steps[activeStepIndex - 1].id)}
            className="flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold text-[#111111]/65 hover:bg-[#F7F7F7] hover:text-[#111111]"
          >
            <ArrowLeft size={14} strokeWidth={2.2} />
            Back
          </button>
        )}

        <button
          type="button"
          onClick={() => setConfirmingReset(true)}
          className="ml-auto flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-[#A63A3A] hover:bg-[#FFF5F5]"
        >
          <RotateCcw size={12} strokeWidth={2.2} />
          Reset this step
        </button>

        <div
          className="flex shrink-0 items-center gap-1 border-l border-[#ECE7DF] pl-3"
          aria-label="Configuration history controls"
        >
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo"
            aria-label="Undo configuration change"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E5E5] text-[#111111]/60 hover:bg-[#F7F7F7] disabled:opacity-35"
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo"
            aria-label="Redo configuration change"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E5E5] text-[#111111]/60 hover:bg-[#F7F7F7] disabled:opacity-35"
          >
            <Redo2 size={14} />
          </button>
          <button
            type="button"
            onClick={onResetAll}
            title="Reset all"
            aria-label="Reset entire configuration"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E5E5] text-[#A63A3A] hover:bg-[#FFF5F5]"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {confirmingReset && (
        <div
          role="alertdialog"
          aria-label={`Remove ${activeStep.title} selection`}
          className="flex items-center justify-between gap-3 border-b border-[#F3D9D9] bg-[#FDF3F3] px-4 py-2.5"
        >
          <p className="text-xs font-medium text-[#8A2E2E]">
            Remove this {activeStep.title.toLowerCase()} selection?
          </p>
          <span className="flex shrink-0 items-center gap-1.5">
            <button
              ref={cancelResetButtonRef}
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="flex h-8 items-center gap-1 rounded-full border border-[#E5E5E5] bg-white px-2.5 text-xs font-semibold text-[#111111]/70"
            >
              <X size={13} />
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmingReset(false);
                resetStep(activeStep.id);
              }}
              className="flex h-8 items-center gap-1 rounded-full bg-[#C62828] px-2.5 text-xs font-semibold text-white"
            >
              <Trash2 size={13} />
              Remove
            </button>
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {activeStep.id === "garment-colour" ? (
          <GarmentColourPanel
            value={colour}
            onChange={(next) => {
              if (selectedColour === undefined) setInternalColour(next);
              onColourChange?.(next);
            }}
            unitBasePrice={unitBasePrice}
          />
        ) : activeStep.id === "artwork" ? (
          <ArtworkPanel
            value={artwork}
            onChange={(next) => {
              if (controlledArtwork === undefined) setInternalArtwork(next);
              onArtworkChange?.(next);
            }}
            activeView={activeView}
            onViewChange={onViewChange}
          />
        ) : (
          <NeckLabelPanel
            key={neckLabel?.fileUrl ?? "empty-neck-label"}
            value={neckLabel}
            onChange={(next) => {
              if (controlledNeckLabel === undefined) setInternalNeckLabel(next);
              onNeckLabelChange?.(next);
            }}
            onClear={() => resetStep("neck-label")}
            isToteProduct={isToteProduct}
          />
        )}
      </div>
    </section>
  );
}
