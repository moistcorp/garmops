"use client";

import { useState } from "react";
import { AccordionItem } from "./AccordionItem";
import GarmentColourPanel from "./GarmentColourPanel/GarmentColourPanel";
import ArtworkPanel from "./ArtworkPanel/ArtworkPanel";
import NeckLabelPanel from "./NeckLabelPanel/NeckLabelPanel";
import type {
  GarmentColour,
  Artwork,
  NeckLabel,
} from "@/lib/configurator/types/configurator";

export type AccordionStepId = "garment-colour" | "artwork" | "neck-label";

export interface AccordionStepState {
  id: AccordionStepId;
  title: string;
  summary: string | null;
  confirmed: boolean;
}

export interface ConfiguratorSidebarProps {
  /** Controlled expanded step. Omit to let the component manage its own state (Phase 4 behaviour). */
  expandedStepId?: AccordionStepId | null;
  /** Fires with the new expanded step (or null) whenever a step is toggled, whether controlled or not. */
  onExpandedStepChange?: (id: AccordionStepId | null) => void;
  /** Current garment colour selection. Omit to fall back to an internal default (Phase 4 shell behaviour for this step). */
  selectedColour?: GarmentColour;
  /** Fires with the new GarmentColour whenever a swatch is picked. */
  onColourChange?: (colour: GarmentColour) => void;
  /** Controlled accordion step list (summary/confirmed per step). Omit to let the component manage its own state internally. */
  steps?: AccordionStepState[];
  /** Fires with the new steps array whenever a step is confirmed or reset, whether controlled or not. */
  onStepsChange?: (steps: AccordionStepState[]) => void;
  /** Current artwork selection (front/back sides). Omit to fall back to an internal default ({}). */
  artwork?: Artwork;
  /** Fires with the new Artwork whenever a side's file, technique, or confirm state changes. */
  onArtworkChange?: (artwork: Artwork) => void;
  /** Current neck label selection. Omit to fall back to internal state (undefined = nothing uploaded/selected yet). */
  neckLabel?: NeckLabel;
  /** Fires with the new NeckLabel once a file and dimension preset are both present. */
  onNeckLabelChange?: (neckLabel: NeckLabel) => void;
}

export const INITIAL_STEPS: AccordionStepState[] = [
  { id: "garment-colour", title: "Garment Colour", summary: null, confirmed: false },
  { id: "artwork", title: "Artwork", summary: null, confirmed: false },
  { id: "neck-label", title: "Neck Label", summary: null, confirmed: false },
];

export const DEFAULT_COLOUR: GarmentColour = {
  type: "signature",
  name: "True Black",
  hex: "#111111",
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
}: ConfiguratorSidebarProps = {}) {
  // Uncontrolled fallback for steps — mirrors the expandedStepId/selectedColour
  // pattern so this component still renders standalone (Phase 4 shell testing)
  // if no steps/onStepsChange is passed in.
  const [internalSteps, setInternalSteps] = useState<AccordionStepState[]>(INITIAL_STEPS);
  const isStepsControlled = controlledSteps !== undefined;
  const steps = isStepsControlled ? controlledSteps : internalSteps;

  function updateSteps(updater: (prev: AccordionStepState[]) => AccordionStepState[]) {
    const next = updater(steps);
    if (!isStepsControlled) {
      setInternalSteps(next);
    }
    onStepsChange?.(next);
  }

  // Uncontrolled fallback for the colour step — mirrors the expandedStepId
  // pattern below so this component still renders standalone (Phase 4 shell
  // testing) if no selectedColour/onColourChange is passed in.
  const [internalColour, setInternalColour] = useState<GarmentColour>(DEFAULT_COLOUR);
  const isColourControlled = selectedColour !== undefined;
  const colour = isColourControlled ? selectedColour : internalColour;

  function handleColourChange(next: GarmentColour) {
    if (!isColourControlled) {
      setInternalColour(next);
    }
    onColourChange?.(next);
  }

  // Uncontrolled fallback for the artwork step — same pattern as colour.
  // Default is {} (no sides uploaded), matching ArtworkPanel's own internal
  // default when it's used standalone/uncontrolled elsewhere.
  const [internalArtwork, setInternalArtwork] = useState<Artwork>({});
  const isArtworkControlled = controlledArtwork !== undefined;
  const artwork = isArtworkControlled ? controlledArtwork : internalArtwork;

  function handleArtworkChange(next: Artwork) {
    if (!isArtworkControlled) {
      setInternalArtwork(next);
    }
    onArtworkChange?.(next);
  }

  // Uncontrolled fallback for the neck-label step — same pattern as artwork.
  // Default is undefined (nothing uploaded/selected yet); NeckLabel itself
  // has no "empty" shape since fileUrl/dimensions/position are all required,
  // so unlike Artwork we can't default to `{}`.
  const [internalNeckLabel, setInternalNeckLabel] = useState<NeckLabel | undefined>(undefined);
  const isNeckLabelControlled = controlledNeckLabel !== undefined;
  const neckLabel = isNeckLabelControlled ? controlledNeckLabel : internalNeckLabel;

  function handleNeckLabelChange(next: NeckLabel) {
    if (!isNeckLabelControlled) {
      setInternalNeckLabel(next);
    }
    onNeckLabelChange?.(next);
  }

  // Uncontrolled fallback — preserves Phase 4 standalone behaviour when no
  // expandedStepId prop is passed in.
  const [internalExpandedStepId, setInternalExpandedStepId] =
    useState<AccordionStepId | null>(null);

  const isControlled = controlledExpandedStepId !== undefined;
  const expandedStepId = isControlled ? controlledExpandedStepId : internalExpandedStepId;

  function toggleStep(id: AccordionStepId) {
    const next = expandedStepId === id ? null : id;
    if (!isControlled) {
      setInternalExpandedStepId(next);
    }
    onExpandedStepChange?.(next);
  }

  // Stubbed for Phase 4 shell testing only — real confirm cycles for
  // garment-colour/artwork/neck-label are driven externally (see
  // ConfigureClient) via the steps/onStepsChange lift.
  function stubConfirmStep(id: AccordionStepId) {
    updateSteps((prev) =>
      prev.map((step) =>
        step.id === id
          ? { ...step, summary: `${step.title} — sample selection`, confirmed: true }
          : step
      )
    );
  }

  function stubResetStep(id: AccordionStepId) {
    updateSteps((prev) =>
      prev.map((step) =>
        step.id === id ? { ...step, summary: null, confirmed: false } : step
      )
    );
  }

  return (
    <div className="flex flex-col gap-2 bg-transparent py-3">
      {steps.map((step) => (
        <AccordionItem
          key={step.id}
          title={step.title}
          summary={step.summary}
          confirmed={step.confirmed}
          expanded={expandedStepId === step.id}
          onToggle={() => toggleStep(step.id)}
          onDelete={() => stubResetStep(step.id)}
        >
          {step.id === "garment-colour" ? (
            <GarmentColourPanel value={colour} onChange={handleColourChange} />
          ) : step.id === "artwork" ? (
            <ArtworkPanel value={artwork} onChange={handleArtworkChange} />
          ) : step.id === "neck-label" ? (
            <NeckLabelPanel value={neckLabel} onChange={handleNeckLabelChange} />
          ) : (
            <div className="flex flex-col gap-2 text-sm text-[#111111]">
              <p className="text-[#111111]/60">
                Panel content for &ldquo;{step.title}&rdquo; is not built yet
                (Phase 4 shell only).
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => stubConfirmStep(step.id)}
                  className="border border-[#111111] px-3 py-1 text-xs uppercase tracking-wide hover:bg-[#111111] hover:text-[#F7F7F7]"
                >
                  Simulate confirm
                </button>
                <button
                  type="button"
                  onClick={() => stubResetStep(step.id)}
                  className="border border-[#E5E5E5] px-3 py-1 text-xs uppercase tracking-wide text-[#111111]/60 hover:border-[#111111] hover:text-[#111111]"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </AccordionItem>
      ))}
    </div>
  );
}
