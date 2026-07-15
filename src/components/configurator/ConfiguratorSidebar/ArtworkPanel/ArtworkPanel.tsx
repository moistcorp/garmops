"use client";

import { useState } from "react";
import { ArtworkUploadSide } from "./ArtworkUploadSide";
import { TechniqueSelect, TECHNIQUE_LABELS } from "./TechniqueSelect";
import type {
  Artwork,
  ArtworkSide,
  ArtworkTechnique,
} from "@/lib/configurator/types/configurator";

export interface ArtworkPanelProps {
  /** Controlled artwork state. Omit to let the component manage its own state internally. */
  value?: Artwork;
  /** Fires with the new Artwork whenever a side's file, technique, or confirm state changes. */
  onChange?: (artwork: Artwork) => void;
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

export function ArtworkPanel({ value, onChange }: ArtworkPanelProps = {}) {
  const [internalArtwork, setInternalArtwork] = useState<Artwork>(value ?? {});
  const isControlled = value !== undefined;
  const artwork = isControlled ? value : internalArtwork;

  function commit(next: Artwork) {
    if (!isControlled) {
      setInternalArtwork(next);
    }
    onChange?.(next);
  }

  function handleSideChange(side: Side, next: ArtworkSide | undefined) {
    commit({ ...artwork, [side]: next });
  }

  function handleTechniqueChange(side: Side, technique: ArtworkTechnique) {
    const current = artwork[side];
    if (!current) return;
    commit({ ...artwork, [side]: { ...current, technique } });
  }

  // Confirm gate: upload + technique only. Position/guidelines fields exist
  // on ArtworkSide but there's no UI for them yet (no Phase 6C was supplied),
  // so they're not part of this gate — see reply notes for this phase.
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
  }

  function renderSide(side: Side) {
    const current = artwork[side];

    if (current?.confirmed) {
      return (
        <div className="flex items-center justify-between border border-[#E5E5E5] px-3 py-2">
          <span className="text-xs text-[#111111]/60">
            {SIDE_LABELS[side]} — {TECHNIQUE_LABELS[current.technique]}
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
            <button
              type="button"
              disabled={!current.technique}
              onClick={() => handleConfirm(side)}
              className="self-start border border-[#111111] px-3 py-1 text-xs uppercase tracking-wide text-[#111111] hover:bg-[#111111] hover:text-[#F7F7F7] disabled:cursor-not-allowed disabled:border-[#E5E5E5] disabled:text-[#111111]/40 disabled:hover:bg-transparent disabled:hover:text-[#111111]/40"
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