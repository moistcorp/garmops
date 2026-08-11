"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArtworkUploadSide,
  SAMPLE_ARTWORK_DIMENSIONS,
  SAMPLE_ARTWORK_HREF,
} from "./ArtworkUploadSide";
import { TechniqueSelect, TECHNIQUE_LABELS } from "./TechniqueSelect";
import { PositionControls } from "./PositionControls";
import {
  constrainArtworkToPrintArea,
  useArtworkPosition,
  type PositionControlsState,
} from "@/lib/configurator/ArtworkPositionContext";
import { DEFAULT_ARTWORK_PRINT_AREA, PRINT_AREA_SIZE_CHART } from "@/lib/configurator/sizecharts";
import {
  applyArtworkPlacementPreset,
  FRONT_PLACEMENT_PRESETS,
  BACK_PLACEMENT_PRESETS,
  placementLabel,
} from "@/lib/configurator/artworkPlacement";
import { getArtworkQuality } from "@/lib/configurator/artworkQuality";
import type {
  Artwork,
  ArtworkSide,
  ArtworkPlacementPreset,
  CustomerArtworkTechnique,
} from "@/lib/configurator/types/configurator";
import { isCustomerArtworkTechnique } from "@/lib/configurator/types/configurator";
import type { GarmentView } from "@/lib/configurator/types/garment";

export interface ArtworkPanelProps {
  value?: Artwork;
  onChange?: (artwork: Artwork) => void;
  activeView?: GarmentView;
  onViewChange?: (view: GarmentView) => void;
}

type Side = "front" | "back";
type PositionSeed = Pick<PositionControlsState, "widthCm" | "heightCm" | "fromNeckCm" | "fromCenterCm">;

const SIDE_LABELS: Record<Side, string> = { front: "Front", back: "Back" };

function positionFromArtwork(current: ArtworkSide): PositionControlsState {
  return {
    alignH: null,
    alignV: null,
    widthCm: current.width,
    heightCm: current.height,
    aspectLocked: true,
    fromNeckCm: current.fromNeck,
    fromCenterCm: current.fromCenter,
  };
}

function artworkFilename(side?: ArtworkSide): string {
  return side?.fileName ?? side?.fileUrl?.split("/").pop() ?? "Artwork";
}

export function ArtworkPanel({ value, onChange, activeView, onViewChange }: ArtworkPanelProps = {}) {
  const [internalArtwork, setInternalArtwork] = useState<Artwork>(value ?? {});
  const artwork = value !== undefined ? value : internalArtwork;
  const [activeSide, setActiveSide] = useState<Side>(activeView === "back" ? "back" : "front");
  const initialSideResolvedRef = useRef(false);
  const { positions, updatePosition } = useArtworkPosition();
  const seededArtworkIdentityRef = useRef<Partial<Record<Side, string>>>({});
  const pendingPositionSeedRef = useRef<Partial<Record<Side, { identity: string; position: PositionSeed }>>>({});

  function commit(next: Artwork) {
    if (value === undefined) setInternalArtwork(next);
    onChange?.(next);
  }

  useEffect(() => {
    if (initialSideResolvedRef.current || (!artwork.front && !artwork.back)) return;
    initialSideResolvedRef.current = true;
    const nextSide: Side = !artwork.front && artwork.back ? "back" : "front";
    setActiveSide(nextSide);
    onViewChange?.(nextSide);
  }, [artwork.back, artwork.front, onViewChange]);

  useEffect(() => {
    ( ["front", "back"] as Side[]).forEach((side) => {
      const current = artwork[side];
      const pos = positions[side];
      if (!current || !pos) {
        seededArtworkIdentityRef.current[side] = undefined;
        pendingPositionSeedRef.current[side] = undefined;
        return;
      }

      const identity = current.fileKey
        ? `key:${current.fileKey}`
        : current.fileId
          ? `file:${current.fileId}`
          : `url:${current.fileUrl}`;
      const isSampleArtwork = current.fileUrl === SAMPLE_ARTWORK_HREF;
      const seed: PositionSeed = {
        widthCm: isSampleArtwork ? SAMPLE_ARTWORK_DIMENSIONS.width : current.width,
        heightCm: isSampleArtwork ? SAMPLE_ARTWORK_DIMENSIONS.height : current.height,
        fromNeckCm: current.fromNeck,
        fromCenterCm: current.fromCenter,
      };

      if (seededArtworkIdentityRef.current[side] !== identity) {
        seededArtworkIdentityRef.current[side] = identity;
        pendingPositionSeedRef.current[side] = { identity, position: seed };
        updatePosition(side, seed);
        return;
      }

      const pendingSeed = pendingPositionSeedRef.current[side];
      if (pendingSeed?.identity === identity) {
        const hasAppliedSeed =
          pos.widthCm === pendingSeed.position.widthCm &&
          pos.heightCm === pendingSeed.position.heightCm &&
          pos.fromNeckCm === pendingSeed.position.fromNeckCm &&
          pos.fromCenterCm === pendingSeed.position.fromCenterCm;
        if (!hasAppliedSeed) {
          updatePosition(side, pendingSeed.position);
          return;
        }
        pendingPositionSeedRef.current[side] = undefined;
      }

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
            placementPreset: "custom",
          },
        });
      }
    });
    // Position state is intentionally synchronized into the persisted side state here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions.front, positions.back, artwork.front, artwork.back]);

  function handleSideChange(side: Side, next: ArtworkSide | undefined) {
    commit({ ...artwork, smallestSize: DEFAULT_ARTWORK_PRINT_AREA, [side]: next });
  }

  function selectSide(side: Side) {
    setActiveSide(side);
    onViewChange?.(side);
  }

  function handleTechniqueChange(side: Side, technique: CustomerArtworkTechnique) {
    const current = artwork[side];
    if (!current) return;
    const constrained = constrainArtworkToPrintArea(
      { ...positions[side], ...positionFromArtwork(current) },
      PRINT_AREA_SIZE_CHART[DEFAULT_ARTWORK_PRINT_AREA],
    );
    updatePosition(side, constrained);
    commit({
      ...artwork,
      [side]: {
        ...current,
        printArea: DEFAULT_ARTWORK_PRINT_AREA,
        technique,
        confirmed: true,
        width: constrained.widthCm,
        height: constrained.heightCm,
        fromNeck: constrained.fromNeckCm,
        fromCenter: constrained.fromCenterCm,
      },
    });
    onViewChange?.(side);
  }

  function applyPreset(side: Side, preset: ArtworkPlacementPreset) {
    const current = artwork[side];
    if (!current) return;
    const nextPosition = applyArtworkPlacementPreset(
      positionFromArtwork(current),
      preset,
      PRINT_AREA_SIZE_CHART[DEFAULT_ARTWORK_PRINT_AREA],
      current,
    );
    updatePosition(side, nextPosition);
    commit({
      ...artwork,
      smallestSize: DEFAULT_ARTWORK_PRINT_AREA,
      [side]: {
        ...current,
        printArea: DEFAULT_ARTWORK_PRINT_AREA,
        placementPreset: preset,
        width: nextPosition.widthCm,
        height: nextPosition.heightCm,
        fromNeck: nextPosition.fromNeckCm,
        fromCenter: nextPosition.fromCenterCm,
      },
    });
    onViewChange?.(side);
  }

  const panelSide: Side = activeView === "back" ? "back" : activeView === "front" ? "front" : activeSide;
  const current = artwork[panelSide];
  const selectedTechnique = isCustomerArtworkTechnique(current?.technique) ? current.technique : undefined;
  const placementPresets = panelSide === "front" ? FRONT_PLACEMENT_PRESETS : BACK_PLACEMENT_PRESETS;
  const selectedPlacement = current?.placementPreset ?? "custom";
  const quality = getArtworkQuality(current);

  return (
    <div className="flex flex-col gap-3.5 text-sm text-(--text-primary)">
      <div className="grid grid-cols-2 border-b border-(--color-rule)" role="tablist" aria-label="Artwork side">
        {(["front", "back"] as Side[]).map((side) => {
          const hasArtwork = Boolean(artwork[side]);
          const selected = panelSide === side;
          return (
            <button
              key={side}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`artwork-${side}-panel`}
              onClick={() => selectSide(side)}
              className={`min-h-11 border-b-2 px-3 text-left text-xs font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/40 ${selected ? "border-(--color-accent) text-(--color-accent-dark)" : "border-transparent text-(--text-primary)/50 hover:text-(--text-primary)"}`}
            >
              {SIDE_LABELS[side]} {hasArtwork ? <span aria-label="Artwork added">✓</span> : <span className="font-normal normal-case">· Optional</span>}
            </button>
          );
        })}
      </div>

      <section id={`artwork-${panelSide}-panel`} role="tabpanel" aria-label={`${SIDE_LABELS[panelSide]} artwork controls`} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-2 pt-4">
          <h3 className="text-xs font-semibold text-(--text-primary)/70">
            <span className="whitespace-nowrap">1 -</span> Artwork file
          </h3>
          <ArtworkUploadSide side={panelSide} value={current} onChange={(next) => handleSideChange(panelSide, next)} />
        </div>

        {current && (
          <>
            <TechniqueSelect value={selectedTechnique} fileType={current.fileType} side={panelSide} onChange={(technique) => handleTechniqueChange(panelSide, technique)} />

            {selectedTechnique && (
              <section className="flex flex-col gap-3 border-t border-(--color-rule) pt-4" aria-labelledby="position-size-title">
                <div>
                  <h3 id="position-size-title" className="text-xs font-semibold text-(--text-primary)/70">
                    <span className="whitespace-nowrap">3 - </span> Position &amp; size
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-(--text-primary)/50">Choose a preset or drag the artwork on the garment.</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {placementPresets.map((preset) => {
                    const selected = selectedPlacement === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => applyPreset(panelSide, preset.id)}
                        className={`min-h-10 rounded-sm border px-2.5 py-2 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/40 ${selected ? "border-(--color-accent) bg-(--color-accent)/8 text-(--color-accent-dark)" : "techpack-control hover:!border-(--color-accent)/45"}`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <div onFocusCapture={() => onViewChange?.(panelSide)} onPointerDownCapture={() => onViewChange?.(panelSide)}>
                    <PositionControls printAreaDimensions={PRINT_AREA_SIZE_CHART[DEFAULT_ARTWORK_PRINT_AREA]} view={panelSide} />
                </div>

                {quality && (
                  <div role="status">
                    <p className="text-xs font-semibold">Artwork quality</p>
                    <p className={`mt-0.5 text-sm font-medium ${quality.label.includes("soft") ? "text-[#8A6212]" : "text-(--color-accent-dark)"}`}>{quality.label}</p>
                    {quality.detail && <p className="mt-1 text-xs leading-relaxed text-(--text-primary)/55">{quality.detail}</p>}
                  </div>
                )}

              </section>
            )}
          </>
        )}
      </section>

      <details>
        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-(--text-primary)/60 marker:hidden">Artwork summary <span aria-hidden="true" className="font-normal">+</span></summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(["front", "back"] as Side[]).map((side) => {
            const item = artwork[side];
            const technique = isCustomerArtworkTechnique(item?.technique) ? TECHNIQUE_LABELS[item.technique] : "Print method not selected";
            return (
              <div key={side} className="rounded-sm bg-[#F7F7F7] px-3 py-2.5 text-xs">
                <p className="font-semibold uppercase tracking-wide text-(--text-primary)/65">{SIDE_LABELS[side]}</p>
                <p className="mt-1 truncate text-(--text-primary)">{item ? artworkFilename(item) : "No artwork"}</p>
                {item && <p className="mt-0.5 text-(--text-primary)/55">{technique} · {placementLabel(item.placementPreset)} · {item.width} × {item.height} cm</p>}
              </div>
            );
          })}
        </div>
      </details>

    </div>
  );
}

export default ArtworkPanel;
