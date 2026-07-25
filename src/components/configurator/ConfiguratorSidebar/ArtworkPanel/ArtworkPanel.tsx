"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { ArtworkUploadSide } from "./ArtworkUploadSide";
import { TechniqueSelect, TECHNIQUE_LABELS } from "./TechniqueSelect";
import { PositionControls } from "./PositionControls";
import { GuidelinesToggles } from "./GuidelinesToggles";
import { ArtworkAreaSizeSelect } from "./ArtworkAreaSizeSelect";
import { useArtworkPosition } from "@/lib/configurator/ArtworkPositionContext";
import { PRINT_AREA_SIZE_CHART } from "@/lib/configurator/sizecharts";
import type {
  Artwork,
  ArtworkSide,
  ArtworkTechnique,
  PrintAreaSize,
} from "@/lib/configurator/types/configurator";
import type { GarmentView } from "@/lib/configurator/types/garment";

export interface ArtworkPanelProps {
  /** Controlled artwork state. Omit to let the component manage its own state internally. */
  value?: Artwork;
  /** Fires with the new Artwork whenever a side's file, technique, or confirm state changes. */
  onChange?: (artwork: Artwork) => void;
  /** Which garment view the live canvas is currently showing. Used so opening a side's
   *  position editor can switch the canvas to that side (front/back). */
  activeView?: GarmentView;
  /** Fires when the panel wants the canvas to switch to a different side. */
  onViewChange?: (view: GarmentView) => void;
}

type Side = "front" | "back";

const SIDE_LABELS: Record<Side, string> = {
  front: "Front",
  back: "Back",
};

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2 7.5l3.2 3.2L12 3.5"
        stroke="#2E7D32"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function techniqueLabel(technique: ArtworkTechnique | undefined): string {
  return technique ? TECHNIQUE_LABELS[technique] : "Technique needed";
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M9.5 1.5l3 3L4 13H1v-3L9.5 1.5z"
        stroke="#111111"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2.5 3.5h9M5.5 3.5V2h3v1.5M3.5 3.5l.6 8.2a1 1 0 0 0 1 .8h3.8a1 1 0 0 0 1-.8l.6-8.2"
        stroke="#C62828"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArtworkPanel({ value, onChange, onViewChange }: ArtworkPanelProps = {}) {
  const [internalArtwork, setInternalArtwork] = useState<Artwork>(value ?? {});
  const isControlled = value !== undefined;
  const artwork = isControlled ? value : internalArtwork;

  // Which side's size/placement editor is currently expanded, if any. Only one
  // side is adjusted at a time, mirroring the single-expanded-step pattern
  // used by the outer accordion.
  const [adjustingSide, setAdjustingSide] = useState<Side | null>(null);

  const { positions } = useArtworkPosition();

  function commit(next: Artwork) {
    if (!isControlled) {
      setInternalArtwork(next);
    }
    onChange?.(next);
  }

  // Keep each confirmed/in-progress side's saved width/height/fromNeck/fromCenter
  // in sync with whatever the canvas drag-box (or the stepper controls below) is
  // currently showing for that view. Without this, position edits only ever lived
  // in ArtworkPositionContext and were lost the moment the config was added to
  // cart, since ArtworkSide.width/height/fromNeck/fromCenter never got updated.
  useEffect(() => {
    (["front", "back"] as Side[]).forEach((side) => {
      const current = artwork[side];
      const pos = positions[side];
      if (!current || !pos) return;
      if (
        current.width !== pos.widthCm ||
        current.height !== pos.heightCm ||
        current.fromNeck !== pos.fromNeckCm ||
        current.fromCenter !== pos.fromCenterCm
      ) {
        commit({
          ...artwork,
          [side]: {
            ...current,
            width: pos.widthCm,
            height: pos.heightCm,
            fromNeck: pos.fromNeckCm,
            fromCenter: pos.fromCenterCm,
          },
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions.front, positions.back, artwork.front, artwork.back]);

  function handleSideChange(side: Side, next: ArtworkSide | undefined) {
    commit({ ...artwork, [side]: next });
    if (!next) setAdjustingSide((prev) => (prev === side ? null : prev));
  }

  function handleTechniqueChange(side: Side, technique: ArtworkTechnique) {
    const current = artwork[side];
    if (!current) return;
    commit({ ...artwork, [side]: { ...current, technique } });
  }

  function handlePrintAreaChange(side: Side, printArea: PrintAreaSize) {
    const current = artwork[side];
    if (!current) return;
    commit({ ...artwork, [side]: { ...current, printArea, guidelines: { ...current.guidelines, maximumArea: true } } });
  }

  function handleGuidelineChange(side: Side, key: "maximumArea" | "leftChest", checked: boolean) {
    const current = artwork[side];
    if (!current) return;
    commit({
      ...artwork,
      [side]: { ...current, guidelines: { ...current.guidelines, [key]: checked } },
    });
  }

  function toggleAdjusting(side: Side) {
    setAdjustingSide((prev) => {
      const next = prev === side ? null : side;
      if (next) onViewChange?.(side);
      return next;
    });
  }

  // Confirm gate: upload + technique only. Size/placement and print guidelines
  // are optional refinements — a customer can confirm with sensible defaults
  // and come back to fine-tune them later via "Adjust Size & Placement".
  function handleConfirm(side: Side) {
    const current = artwork[side];
    if (!current || !current.technique) return;
    commit({ ...artwork, [side]: { ...current, confirmed: true } });
  }

  function handleEdit(side: Side) {
    const current = artwork[side];
    if (!current) return;
    commit({ ...artwork, [side]: { ...current, confirmed: false } });
  }

  function handleDelete(side: Side) {
    commit({ ...artwork, [side]: undefined });
    setAdjustingSide((prev) => (prev === side ? null : prev));
  }

  function renderAdjustToggle(side: Side) {
    const isOpen = adjustingSide === side;
    return (
      <button
        type="button"
        onClick={() => toggleAdjusting(side)}
        aria-expanded={isOpen}
        className={`flex items-center justify-center gap-1.5 self-start border px-3 py-1 text-xs uppercase tracking-wide transition-colors ${
          isOpen
            ? "border-[var(--color-teal)] bg-[var(--color-teal)] text-white"
            : "border-[#E5E5E5] text-[#111111]/70 hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"
        }`}
      >
        <SlidersHorizontal size={13} strokeWidth={2.2} />
        {isOpen ? "Close Adjustments" : "Adjust Size & Placement"}
      </button>
    );
  }

  function renderAdjustPanel(side: Side, current: ArtworkSide) {
    if (adjustingSide !== side) return null;
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-[#ECE7DF] bg-[var(--color-cream-soft)] p-3">
        <p className="text-xs text-[#111111]/55">
          Drag or resize the box directly on the {SIDE_LABELS[side].toLowerCase()} preview, or use
          the controls below for precise placement.
        </p>
        <ArtworkAreaSizeSelect
          value={current.printArea}
          onChange={(size) => handlePrintAreaChange(side, size)}
        />
        <PositionControls />
        <GuidelinesToggles
          printAreaDimensions={PRINT_AREA_SIZE_CHART[current.printArea]}
          maximumArea={current.guidelines.maximumArea}
          leftChest={current.guidelines.leftChest}
          onMaximumAreaChange={(v) => handleGuidelineChange(side, "maximumArea", v)}
          onLeftChestChange={(v) => handleGuidelineChange(side, "leftChest", v)}
        />
      </div>
    );
  }

  function renderSide(side: Side) {
    const current = artwork[side];

    if (current?.confirmed) {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-xl border border-[#ECE7DF] bg-white px-3 py-2">
            <span className="text-xs text-[#111111]/60">
              {SIDE_LABELS[side]} — {techniqueLabel(current.technique)}
            </span>
            <span className="flex items-center gap-2">
              <CheckIcon />
              <span
                role="button"
                tabIndex={0}
                onClick={() => handleEdit(side)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handleEdit(side);
                }}
                aria-label={`Edit ${SIDE_LABELS[side]} artwork`}
              >
                <PencilIcon />
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={() => handleDelete(side)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handleDelete(side);
                }}
                aria-label={`Remove ${SIDE_LABELS[side]} artwork`}
              >
                <TrashIcon />
              </span>
            </span>
          </div>
          {renderAdjustToggle(side)}
          {renderAdjustPanel(side, current)}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        <ArtworkUploadSide
          side={side}
          value={current}
          onChange={(next) => handleSideChange(side, next)}
        />
        {current && (
          <>
            <TechniqueSelect
              value={current.technique}
              onChange={(technique) => handleTechniqueChange(side, technique)}
            />
            {renderAdjustToggle(side)}
            {renderAdjustPanel(side, current)}
            <button
              type="button"
              disabled={!current.technique}
              onClick={() => handleConfirm(side)}
              className="self-start rounded-full border border-[var(--color-teal)] px-3 py-1 text-xs uppercase tracking-wide text-[var(--color-teal)] hover:bg-[var(--color-teal)] hover:text-white disabled:cursor-not-allowed disabled:border-[#E5E5E5] disabled:text-[#111111]/40 disabled:hover:bg-transparent disabled:hover:text-[#111111]/40"
            >
              Confirm {SIDE_LABELS[side]}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-sm text-[#111111]">
      {renderSide("front")}
      {renderSide("back")}
    </div>
  );
}

export default ArtworkPanel;
