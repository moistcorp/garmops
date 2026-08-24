"use client";

import { Tabs } from "@base-ui/react/tabs";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  ArtworkUploadSide,
  SAMPLE_ARTWORK_DIMENSIONS,
  SAMPLE_ARTWORK_HREF,
} from "./ArtworkUploadSide";
import { TechniqueSelect, TECHNIQUE_LABELS } from "./TechniqueSelect";
import ReflectiveColourSelect from "./ReflectiveColourSelect";
import { PositionControls } from "./PositionControls";
import { GuidelinesToggles } from "./GuidelinesToggles";
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
import { getGarmentInsetPercent, getGarmentPrintArea } from "@/lib/configurator/garmentGeometry";
import type { ProductId } from "@/lib/configurator/pricing";
import type {
  Artwork,
  ArtworkSide,
  ArtworkPlacementPreset,
  CustomerArtworkTechnique,
} from "@/lib/configurator/types/configurator";
import { isCustomerArtworkTechnique } from "@/lib/configurator/types/configurator";
import type { ReflectiveColourKey } from "@/lib/configurator/reflectiveColours";
import { DEFAULT_REFLECTIVE_COLOUR } from "@/lib/configurator/reflectiveColours";
import type { GarmentView } from "@/lib/configurator/types/garment";
import { getArtworkContrast, getArtworkQuality } from "@/lib/configurator/artworkQuality";

export interface ArtworkPanelProps {
  productId?: ProductId;
  value?: Artwork;
  onChange?: (artwork: Artwork) => void;
  activeView?: GarmentView;
  onViewChange?: (view: GarmentView) => void;
  garmentColourHex?: string;
  quantity?: number;
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

export function ArtworkPanel({ productId, value, onChange, activeView, onViewChange, garmentColourHex = "#FFFFFF", quantity = 50 }: ArtworkPanelProps = {}) {
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

  function getPlacementArea(side: Side) {
    return productId
      ? getGarmentPrintArea(productId, side, getGarmentInsetPercent(productId, side)) ?? PRINT_AREA_SIZE_CHART[DEFAULT_ARTWORK_PRINT_AREA]
      : PRINT_AREA_SIZE_CHART[DEFAULT_ARTWORK_PRINT_AREA];
  }

  function handleTechniqueChange(side: Side, technique: CustomerArtworkTechnique) {
    const current = artwork[side];
    if (!current) return;
    const constrained = constrainArtworkToPrintArea(
      { ...positions[side], ...positionFromArtwork(current) },
      getPlacementArea(side),
    );
    updatePosition(side, constrained);
    commit({
      ...artwork,
      [side]: {
        ...current,
        printArea: DEFAULT_ARTWORK_PRINT_AREA,
        technique,
        ...(technique === "reflective_print" && !current.reflectiveColour
          ? { reflectiveColour: DEFAULT_REFLECTIVE_COLOUR }
          : {}),
        confirmed: true,
        width: constrained.widthCm,
        height: constrained.heightCm,
        fromNeck: constrained.fromNeckCm,
        fromCenter: constrained.fromCenterCm,
      },
    });
    onViewChange?.(side);
  }

  function handleReflectiveColourChange(side: Side, reflectiveColour: ReflectiveColourKey) {
    const current = artwork[side];
    if (!current || current.technique !== "reflective_print") return;
    commit({
      ...artwork,
      [side]: { ...current, reflectiveColour },
    });
    onViewChange?.(side);
  }

  function applyPreset(side: Side, preset: ArtworkPlacementPreset) {
    const current = artwork[side];
    if (!current) return;
    const nextPosition = applyArtworkPlacementPreset(
      positionFromArtwork(current),
      preset,
      getPlacementArea(side),
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

  function updateGuidelines(side: Side, guidelines: ArtworkSide["guidelines"]) {
    const currentSide = artwork[side];
    if (!currentSide) return;
    commit({
      ...artwork,
      [side]: {
        ...currentSide,
        guidelines,
      },
    });
    onViewChange?.(side);
  }

  const panelSide: Side = activeView === "back" ? "back" : activeView === "front" ? "front" : activeSide;
  const current = artwork[panelSide];
  const placementArea = getPlacementArea(panelSide);
  const selectedTechnique = isCustomerArtworkTechnique(current?.technique) ? current.technique : undefined;
  const placementPresets = panelSide === "front" ? FRONT_PLACEMENT_PRESETS : BACK_PLACEMENT_PRESETS;
  const selectedPlacement = current?.placementPreset ?? "custom";
  const artworkQuality = getArtworkQuality(current);
  const artworkContrast = getArtworkContrast(current, garmentColourHex);
  const recommendedTechnique: CustomerArtworkTechnique | undefined = current
    ? current.isContinuousTone || (current.detectedColorCount ?? 0) > 4
      ? "dtf"
      : "screen_print"
    : undefined;
  const workflowSteps = [
    { label: "File", complete: Boolean(current), active: !current },
    { label: "Print method", complete: Boolean(selectedTechnique), active: Boolean(current && !selectedTechnique) },
    { label: "Placement", complete: Boolean(selectedTechnique), active: false },
  ];

  return (
    <div className="flex flex-col gap-4 text-sm text-(--text-primary)">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-(--text-primary)">
          <span aria-hidden="true" className="mr-1 font-mono text-xs font-semibold tracking-[0.06em] text-(--color-accent)">
            03 ·
          </span>
          Add your artwork
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-(--text-primary)/60">
          Optional. Add artwork to either side, or continue without artwork.
        </p>
      </div>

      <ol className="grid grid-cols-3 gap-1.5" aria-label={`${SIDE_LABELS[panelSide]} artwork setup progress`}>
        {workflowSteps.map((step, index) => (
          <li
            key={step.label}
            aria-current={step.active ? "step" : undefined}
            className={`rounded-sm border px-2 py-2 ${
              step.complete
                ? "border-(--color-accent)/25 bg-(--color-accent)/6"
                : step.active
                  ? "border-(--color-accent) bg-white"
                  : "border-(--color-rule) bg-(--color-cream-soft)/45"
            }`}
          >
            <p className={`font-mono text-[9px] font-semibold uppercase tracking-[0.05em] ${
              step.complete || step.active ? "text-(--color-accent)" : "text-(--text-primary)/35"
            }`}>
              {String(index + 1).padStart(2, "0")} {step.complete ? "Ready" : step.active ? "Current" : "Waiting"}
            </p>
            <p className={`mt-0.5 truncate text-[11px] font-semibold ${
              step.complete || step.active ? "text-(--text-primary)" : "text-(--text-primary)/40"
            }`}>{step.label}</p>
          </li>
        ))}
      </ol>

      <Tabs.Root value={panelSide} onValueChange={(side) => selectSide(side as Side)} className="flex flex-col gap-3.5">
        <Tabs.List activateOnFocus className="grid grid-cols-2 border-b border-(--color-rule)" aria-label="Artwork side">
          {(["front", "back"] as Side[]).map((side) => {
            const hasArtwork = Boolean(artwork[side]);
            return (
              <Tabs.Tab
                key={side}
                value={side}
                className="min-h-11 border-b-2 border-transparent px-3 text-left text-xs font-semibold uppercase tracking-wide text-(--text-primary)/50 transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-(--text-primary) aria-selected:border-(--color-accent) aria-selected:text-(--color-accent-dark) focus-visible:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)"
              >
                {SIDE_LABELS[side]} <span className="font-normal normal-case">· {hasArtwork ? "Added" : "Optional"}</span>
              </Tabs.Tab>
            );
          })}
        </Tabs.List>

        <Tabs.Panel value={panelSide} className="flex flex-col gap-3.5 outline-none" aria-label={`${SIDE_LABELS[panelSide]} artwork controls`}>
        <div className={`flex flex-col gap-2 pt-4 ${current ? "sticky top-0 z-10 bg-white pb-2" : ""}`}>
          <h3 className="text-xs font-semibold text-(--text-primary)/70">
            <span className="whitespace-nowrap">1 —</span> Artwork file
          </h3>
          <ArtworkUploadSide side={panelSide} value={current} onChange={(next) => handleSideChange(panelSide, next)} />
        </div>

        {current && (
          <>
            <div className="grid gap-2" aria-label="Artwork production checks">
              {artworkContrast?.lowContrast ? (
                <div className="flex items-start gap-2 rounded-sm border border-amber-700/30 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950" role="alert">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <div><p className="font-semibold">Low colour contrast</p><p className="mt-0.5 opacity-75">{artworkContrast.message}</p></div>
                </div>
              ) : null}
              {artworkQuality?.label.startsWith("May") ? (
                <div className="rounded-sm border border-amber-700/30 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
                  <p className="font-semibold text-(--text-primary)">{artworkQuality.label}{artworkQuality.effectivePpi ? ` · ${artworkQuality.effectivePpi} PPI` : ""}</p>
                  {artworkQuality.detail ? <p className="mt-0.5 opacity-75">{artworkQuality.detail}</p> : null}
                </div>
              ) : null}
            </div>

            <TechniqueSelect value={selectedTechnique} side={panelSide} quantity={quantity} recommendedTechnique={recommendedTechnique} onChange={(technique) => handleTechniqueChange(panelSide, technique)} />

            {selectedTechnique === "reflective_print" && (
              <ReflectiveColourSelect
                value={current.reflectiveColour}
                side={panelSide}
                onChange={(reflectiveColour) =>
                  handleReflectiveColourChange(panelSide, reflectiveColour)
                }
              />
            )}

            {selectedTechnique && (
              <section className="flex flex-col gap-3 pt-4" aria-labelledby="position-size-title">
                <div>
                  <h3 id="position-size-title" className="text-xs font-semibold text-(--text-primary)/70">
                    <span className="whitespace-nowrap">3 — </span> Position &amp; size
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
                        className={`min-h-10 rounded-sm border px-2.5 py-2 text-left text-xs font-semibold transition-colors focus-visible:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)/40 ${selected ? "border-(--color-accent) bg-(--color-accent)/8 text-(--color-accent-dark)" : "techpack-control hover:!border-(--color-accent)/45"}`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <details className="rounded-sm border border-(--color-rule) bg-white">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-semibold text-(--text-primary)/70 marker:hidden">
                    <span>Fine-tune placement</span>
                    <span className="font-mono text-[10px] font-medium text-(--text-primary)/45">
                      {current.width} × {current.height} cm · +
                    </span>
                  </summary>
                  <div className="space-y-4 border-t border-(--color-rule) px-3 py-3">
                    <div onFocusCapture={() => onViewChange?.(panelSide)} onPointerDownCapture={() => onViewChange?.(panelSide)}>
                      <PositionControls printAreaDimensions={placementArea} view={panelSide} />
                    </div>

                    <GuidelinesToggles
                      value={current.guidelines}
                      onChange={(guidelines) => updateGuidelines(panelSide, guidelines)}
                      showLeftChest={panelSide === "front" && !productId?.includes("tote")}
                    />
                  </div>
                </details>

              </section>
            )}
          </>
        )}
        </Tabs.Panel>
      </Tabs.Root>

      <details className="rounded-sm border border-(--color-rule) bg-(--color-cream-soft)/35 px-3 py-2.5">
        <summary className="cursor-pointer list-none marker:hidden">
          <span className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-(--text-primary)/60">
            Artwork summary <span aria-hidden="true" className="font-normal">+</span>
          </span>
          <span className="mt-1.5 block text-xs leading-relaxed text-(--text-primary)/55">
            {(["front", "back"] as Side[]).map((side) => {
              const item = artwork[side];
              const technique = isCustomerArtworkTechnique(item?.technique) ? TECHNIQUE_LABELS[item.technique] : item ? "File added" : "Not added";
              return `${SIDE_LABELS[side]}: ${technique}`;
            }).join(" · ")}
          </span>
        </summary>
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
