"use client";

import { useState } from "react";
import { AccordionItem } from "./AccordionItem";
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

  function updateSteps(updater: (current: AccordionStepState[]) => AccordionStepState[]) {
    const next = updater(steps);
    if (controlledSteps === undefined) setInternalSteps(next);
    onStepsChange?.(next);
  }

  function toggleStep(id: AccordionStepId) {
    const next = expandedStepId === id ? null : id;
    if (onAttemptStepChange) {
      onAttemptStepChange(next);
      return;
    }
    if (controlledExpandedStepId === undefined) setInternalExpandedStepId(next);
    onExpandedStepChange?.(next);
  }

  function resetStep(id: AccordionStepId) {
    if (id === "artwork") {
      revokeArtworkObjectUrls(artwork);
      if (controlledArtwork === undefined) setInternalArtwork({});
    }
    if (id === "neck-label") {
      revokeNeckLabelObjectUrl(neckLabel);
      if (controlledNeckLabel === undefined) setInternalNeckLabel(undefined);
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
    <div className="flex h-full min-h-0 flex-col gap-2 bg-transparent py-3">
      {steps.map((step) => (
        <AccordionItem
          key={step.id}
          title={isToteProduct && step.id === "neck-label" ? "Bag Label" : step.title}
          summary={step.summary}
          confirmed={step.confirmed}
          skipped={step.skipped}
          optional={step.id !== "garment-colour"}
          expanded={expandedStepId === step.id}
          onToggle={() => toggleStep(step.id)}
          onDelete={() => resetStep(step.id)}
          hideDelete={step.id === "garment-colour"}
        >
          {step.id === "garment-colour" ? (
            <GarmentColourPanel
              value={colour}
              onChange={(next) => {
                if (selectedColour === undefined) setInternalColour(next);
                onColourChange?.(next);
              }}
              unitBasePrice={unitBasePrice}
            />
          ) : step.id === "artwork" ? (
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
        </AccordionItem>
      ))}
    </div>
  );
}
