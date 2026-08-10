"use client";

import { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";
import {
  ArtworkUploadSide,
  SAMPLE_ARTWORK_DIMENSIONS,
  SAMPLE_ARTWORK_HREF,
} from "./ArtworkUploadSide";
import { TechniqueSelect, TECHNIQUE_LABELS } from "./TechniqueSelect";
import { PositionControls } from "./PositionControls";
import { GuidelinesToggles } from "./GuidelinesToggles";
import { ArtworkAreaSizeSelect } from "./ArtworkAreaSizeSelect";
import {
  constrainArtworkToPrintArea,
  useArtworkPosition,
  type PositionControlsState,
} from "@/lib/configurator/ArtworkPositionContext";
import { PRINT_AREA_SIZE_CHART } from "@/lib/configurator/sizecharts";
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
  PrintAreaSize,
} from "@/lib/configurator/types/configurator";
import { isCustomerArtworkTechnique } from "@/lib/configurator/types/configurator";
import type { GarmentView } from "@/lib/configurator/types/garment";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";

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
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
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
    commit({ ...artwork, [side]: next });
  }

  function selectSide(side: Side) {
    setActiveSide(side);
    setCopyNotice(null);
    onViewChange?.(side);
  }

  function handleTechniqueChange(side: Side, technique: CustomerArtworkTechnique) {
    const current = artwork[side];
    if (!current) return;
    const constrained = constrainArtworkToPrintArea(
      { ...positions[side], ...positionFromArtwork(current) },
      PRINT_AREA_SIZE_CHART[current.printArea],
    );
    updatePosition(side, constrained);
    commit({
      ...artwork,
      [side]: {
        ...current,
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

  function handlePrintAreaChange(printArea: PrintAreaSize) {
    const nextArtwork: Artwork = { ...artwork, smallestSize: printArea };
    (["front", "back"] as Side[]).forEach((side) => {
      const current = artwork[side];
      if (!current) return;
      const constrained = constrainArtworkToPrintArea(positionFromArtwork(current), PRINT_AREA_SIZE_CHART[printArea]);
      updatePosition(side, constrained);
      nextArtwork[side] = {
        ...current,
        printArea,
        width: constrained.widthCm,
        height: constrained.heightCm,
        fromNeck: constrained.fromNeckCm,
        fromCenter: constrained.fromCenterCm,
        guidelines: { ...current.guidelines, maximumArea: true },
      };
    });
    commit(nextArtwork);
  }

  function handleGuidelineChange(side: Side, checked: boolean) {
    const current = artwork[side];
    if (!current) return;
    commit({ ...artwork, [side]: { ...current, guidelines: { ...current.guidelines, maximumArea: checked } } });
  }

  function applyPreset(side: Side, preset: ArtworkPlacementPreset) {
    const current = artwork[side];
    if (!current) return;
    const nextPosition = applyArtworkPlacementPreset(
      positionFromArtwork(current),
      preset,
      PRINT_AREA_SIZE_CHART[current.printArea],
      current,
    );
    updatePosition(side, nextPosition);
    commit({
      ...artwork,
      [side]: {
        ...current,
        placementPreset: preset,
        width: nextPosition.widthCm,
        height: nextPosition.heightCm,
        fromNeck: nextPosition.fromNeckCm,
        fromCenter: nextPosition.fromCenterCm,
      },
    });
    onViewChange?.(side);
  }

  function copyArtworkToBack() {
    const source = artwork.front;
    if (!source || artwork.back) return;
    const printArea = artwork.smallestSize ?? source.printArea;
    const safeArea = PRINT_AREA_SIZE_CHART[printArea];
    const centred = applyArtworkPlacementPreset(
      positionFromArtwork(source),
      "centre-back",
      safeArea,
      source,
    );
    const constrained = constrainArtworkToPrintArea(
      { ...centred, widthCm: source.width, heightCm: source.height, fromCenterCm: 0 },
      safeArea,
    );
    const wasAdjusted = constrained.widthCm !== source.width || constrained.heightCm !== source.height;
    const destination: ArtworkSide = {
      ...source,
      printArea,
      placementPreset: "centre-back",
      confirmed: false,
      width: constrained.widthCm,
      height: constrained.heightCm,
      fromNeck: constrained.fromNeckCm,
      fromCenter: constrained.fromCenterCm,
      guidelines: { ...source.guidelines, maximumArea: true },
    };
    updatePosition("back", constrained);
    commit({ ...artwork, smallestSize: printArea, back: destination });
    selectSide("back");
    setCopyNotice(wasAdjusted ? "The back artwork was reduced to fit its safe print area." : "The same artwork is now centred on the back.");
    trackConfiguratorEvent("artwork_copied_to_back");
  }

  const panelSide: Side = activeView === "back" ? "back" : activeView === "front" ? "front" : activeSide;
  const current = artwork[panelSide];
  const selectedTechnique = isCustomerArtworkTechnique(current?.technique) ? current.technique : undefined;
  const placementPresets = panelSide === "front" ? FRONT_PLACEMENT_PRESETS : BACK_PLACEMENT_PRESETS;
  const selectedPlacement = current?.placementPreset ?? "custom";
  const quality = getArtworkQuality(current);
  const safeSize = artwork.smallestSize ?? current?.printArea;

  return (
    <div className="flex flex-col gap-4 text-sm text-[var(--text-primary)]">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Add your artwork</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--text-primary)]/55">Upload artwork for the front, back, or both.</p>
      </div>

      <div className="grid grid-cols-2 border-b border-[var(--color-rule)]" role="tablist" aria-label="Artwork side">
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
              className={`min-h-11 border-b-2 px-3 text-left text-xs font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40 ${selected ? "border-[var(--color-accent)] text-[var(--color-accent-dark)]" : "border-transparent text-[var(--text-primary)]/50 hover:text-[var(--text-primary)]"}`}
            >
              {SIDE_LABELS[side]} {hasArtwork ? <span aria-label="Artwork added">✓</span> : <span className="font-normal normal-case">· Optional</span>}
            </button>
          );
        })}
      </div>

      {copyNotice && <p className="rounded-[4px] border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/6 px-3 py-2 text-xs leading-relaxed text-[var(--color-accent-dark)]" role="status">{copyNotice}</p>}

      <section id={`artwork-${panelSide}-panel`} role="tabpanel" aria-label={`${SIDE_LABELS[panelSide]} artwork controls`} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-[var(--text-primary)]/70">
            <span className="whitespace-nowrap">1 —</span> Upload artwork
          </h3>
          <ArtworkUploadSide side={panelSide} value={current} onChange={(next) => handleSideChange(panelSide, next)} />
        </div>

        {current && (
          <>
            <TechniqueSelect value={selectedTechnique} fileType={current.fileType} side={panelSide} onChange={(technique) => handleTechniqueChange(panelSide, technique)} />

            {selectedTechnique && (
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--text-primary)]/70">
                    <span className="whitespace-nowrap">3 —</span> Position &amp; size
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-primary)]/55">Drag the artwork on the garment to move it. Drag the handle to resize.</p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {placementPresets.map((preset) => {
                    const selected = selectedPlacement === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => applyPreset(panelSide, preset.id)}
                        className={`min-h-12 rounded-[4px] border px-2 py-2 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40 ${selected ? "border-[var(--color-accent)] bg-[var(--color-accent)]/8 text-[var(--color-accent-dark)]" : "techpack-control hover:!border-[var(--color-accent)]/45"}`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <ArtworkAreaSizeSelect value={safeSize ?? current.printArea} onChange={handlePrintAreaChange} />

                <details className="techpack-control rounded-[4px] border p-3">
                  <summary className="cursor-pointer text-xs font-semibold">Fine tune placement +</summary>
                  <div className="mt-3" onFocusCapture={() => onViewChange?.(panelSide)} onPointerDownCapture={() => onViewChange?.(panelSide)}>
                    <PositionControls printAreaDimensions={PRINT_AREA_SIZE_CHART[current.printArea]} view={panelSide} />
                  </div>
                </details>

                <details className="techpack-control rounded-[4px] border p-3">
                  <summary className="cursor-pointer text-xs font-semibold">Preview guides +</summary>
                  <div className="mt-3">
                    <GuidelinesToggles
                      maximumArea={current.guidelines.maximumArea}
                      onMaximumAreaChange={(checked) => handleGuidelineChange(panelSide, checked)}
                    />
                  </div>
                </details>

                {quality && (
                  <div className="rounded-[4px] border border-[var(--color-rule)] bg-[#F7F7F7] px-3 py-2.5" role="status">
                    <p className="text-xs font-semibold">Artwork quality</p>
                    <p className={`mt-0.5 text-sm font-medium ${quality.label.includes("soft") ? "text-[#8A6212]" : "text-[var(--color-accent-dark)]"}`}>{quality.label}</p>
                    {quality.detail && <p className="mt-1 text-xs leading-relaxed text-[var(--text-primary)]/55">{quality.detail}</p>}
                  </div>
                )}

                {!artwork.back && panelSide === "front" && (
                  <button type="button" onClick={copyArtworkToBack} className="techpack-control inline-flex min-h-10 items-center justify-center gap-2 rounded-[4px] border px-3 text-xs font-semibold text-[var(--text-primary)]/75 hover:!border-[var(--color-accent)]/45 hover:text-[var(--color-accent-dark)]">
                    <Copy size={14} aria-hidden="true" /> Use same artwork on back
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <section className="border-t border-[var(--color-rule)] pt-4" aria-labelledby="artwork-summary-title">
        <h3 id="artwork-summary-title" className="text-xs font-semibold uppercase tracking-wide text-[var(--text-primary)]/70">Artwork summary</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(["front", "back"] as Side[]).map((side) => {
            const item = artwork[side];
            const technique = isCustomerArtworkTechnique(item?.technique) ? TECHNIQUE_LABELS[item.technique] : "Print method not selected";
            return (
              <div key={side} className="rounded-[4px] bg-[#F7F7F7] px-3 py-2.5 text-xs">
                <p className="font-semibold uppercase tracking-wide text-[var(--text-primary)]/65">{SIDE_LABELS[side]}</p>
                <p className="mt-1 truncate text-[var(--text-primary)]">{item ? artworkFilename(item) : "No artwork"}</p>
                {item && <p className="mt-0.5 text-[var(--text-primary)]/55">{technique} · {placementLabel(item.placementPreset)} · {item.width} × {item.height} cm</p>}
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}

export default ArtworkPanel;
