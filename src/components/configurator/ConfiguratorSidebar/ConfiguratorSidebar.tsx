"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { X } from "lucide-react";
import GarmentColourPanel from "./GarmentColourPanel/GarmentColourPanel";
import type { GarmentColour, Artwork, NeckLabel } from "@/lib/configurator/types/configurator";
import { SIGNATURE_COLOURS } from "@/lib/configurator/colourRules";
import { revokeArtworkObjectUrls, revokeNeckLabelObjectUrl } from "@/lib/configurator/objectUrls";
import type { GarmentView } from "@/lib/configurator/types/garment";

function PanelLoading() {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <div className="h-16 animate-pulse rounded-[4px] bg-black/5" />
      <div className="h-24 animate-pulse rounded-[4px] bg-black/5" />
      <span className="sr-only">Loading configurator panel</span>
    </div>
  );
}

const ArtworkPanel = dynamic(
  () => import("./ArtworkPanel/ArtworkPanel"),
  { loading: PanelLoading },
);
const NeckLabelPanel = dynamic(
  () => import("./NeckLabelPanel/NeckLabelPanel"),
  { loading: PanelLoading },
);

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
  isToteProduct?: boolean;
  onResetStep?: (id: AccordionStepId) => void;
  activeStepSummary?: string;
  draftRestored?: boolean;
  onDismissDraftRestored?: () => void;
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
  isToteProduct = false,
  onResetStep,
  activeStepSummary,
  draftRestored = false,
  onDismissDraftRestored,
}: ConfiguratorSidebarProps = {}) {
  const [internalSteps, setInternalSteps] = useState<AccordionStepState[]>(INITIAL_STEPS);
  const steps = controlledSteps ?? internalSteps;
  const [internalColour, setInternalColour] = useState<GarmentColour>(DEFAULT_COLOUR);
  const colour = selectedColour ?? internalColour;
  const [internalArtwork, setInternalArtwork] = useState<Artwork>({});
  const artwork = controlledArtwork ?? internalArtwork;
  const [internalNeckLabel, setInternalNeckLabel] = useState<NeckLabel | undefined>(undefined);
  const neckLabel = controlledNeckLabel ?? internalNeckLabel;
  const expandedStepId =
    controlledExpandedStepId !== undefined ? controlledExpandedStepId : "garment-colour";
  const activeStepIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === expandedStepId)
  );
  const activeStep = steps[activeStepIndex] ?? INITIAL_STEPS[0];

  function updateSteps(updater: (current: AccordionStepState[]) => AccordionStepState[]) {
    const next = updater(steps);
    if (controlledSteps === undefined) setInternalSteps(next);
    onStepsChange?.(next);
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

  const activeStepTitle =
    isToteProduct && activeStep.id === "neck-label"
      ? "Bag Label"
      : activeStep.title.replace("Garment ", "");
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      <div className="shrink-0 border-b border-[var(--color-control-border)] bg-white px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{activeStepTitle}</h2>
          <p className="mt-0.5 truncate text-xs text-[var(--text-primary)]/55" title={activeStepSummary}>
            {activeStepSummary ?? activeStep.summary ?? "Not added yet"}
          </p>
        </div>
      </div>

      {draftRestored && (
        <div className="techpack-subtle flex shrink-0 items-center justify-between gap-2 border-x-0 border-t-0 px-4 py-2 text-xs text-[var(--color-accent)]">
          <span>Restored your saved progress.</span>
          <button
            type="button"
            onClick={onDismissDraftRestored}
            aria-label="Dismiss restored progress message"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border border-[var(--color-rule)] hover:bg-white"
          >
            <X size={13} aria-hidden="true" />
          </button>
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
