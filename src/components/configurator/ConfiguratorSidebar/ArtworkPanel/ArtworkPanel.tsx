"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Copy, MapPin, RotateCcw, SlidersHorizontal, Trash2 } from "lucide-react";
import { ArtworkUploadSide } from "./ArtworkUploadSide";
import { TechniqueSelect, TECHNIQUE_LABELS } from "./TechniqueSelect";
import { PositionControls } from "./PositionControls";
import { GuidelinesToggles, LEFT_CHEST_DIMENSIONS } from "./GuidelinesToggles";
import { ArtworkAreaSizeSelect } from "./ArtworkAreaSizeSelect";
import {
  clampDim,
  DEFAULT_POSITION_STATE,
  useArtworkPosition,
  type PositionControlsState,
} from "@/lib/configurator/ArtworkPositionContext";
import { PRINT_AREA_SIZE_CHART } from "@/lib/configurator/sizecharts";
import type {
  Artwork,
  ArtworkSide,
  ArtworkTechnique,
  PrintAreaSize,
} from "@/lib/configurator/types/configurator";
import type { GarmentView } from "@/lib/configurator/types/garment";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";

export interface ArtworkPanelProps {
  value?: Artwork;
  onChange?: (artwork: Artwork) => void;
  activeView?: GarmentView;
  onViewChange?: (view: GarmentView) => void;
}

type Side = "front" | "back";

const SIDE_LABELS: Record<Side, string> = {
  front: "Front",
  back: "Back",
};

const LEFT_CHEST_FROM_CENTER_CM = 9;
const RECOMMENDED_ARTWORK_WIDTH_CM = 20;

function fitWithin(
  current: ArtworkSide,
  maxWidth: number,
  maxHeight: number,
  preferredWidth: number = RECOMMENDED_ARTWORK_WIDTH_CM
): Pick<PositionControlsState, "widthCm" | "heightCm"> {
  const ratio = current.width > 0 && current.height > 0 ? current.width / current.height : 1;
  let width = Math.min(preferredWidth, maxWidth);
  let height = width / ratio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }

  return {
    widthCm: clampDim(width, 1, maxWidth),
    heightCm: clampDim(height, 1, maxHeight),
  };
}

export function ArtworkPanel({ value, onChange, onViewChange }: ArtworkPanelProps = {}) {
  const [internalArtwork, setInternalArtwork] = useState<Artwork>(value ?? {});
  const isControlled = value !== undefined;
  const artwork = isControlled ? value : internalArtwork;
  const [adjustingSide, setAdjustingSide] = useState<Side | null>(null);
  const { positions, updatePosition } = useArtworkPosition();

  function commit(next: Artwork) {
    if (!isControlled) setInternalArtwork(next);
    onChange?.(next);
  }

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
    commit({ ...artwork, [side]: { ...current, technique, confirmed: true } });
  }

  function handlePrintAreaChange(side: Side, printArea: PrintAreaSize) {
    const current = artwork[side];
    if (!current) return;
    commit({
      ...artwork,
      [side]: {
        ...current,
        printArea,
        guidelines: { ...current.guidelines, maximumArea: true },
      },
    });
  }

  function handleGuidelineChange(
    side: Side,
    key: "maximumArea" | "leftChest",
    checked: boolean
  ) {
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

  function applyPlacement(
    side: Side,
    partial: Partial<PositionControlsState>,
    artworkOverrides: Partial<ArtworkSide> = {}
  ) {
    const current = artwork[side];
    if (!current) return;

    const nextPosition = { ...positions[side], ...partial };
    updatePosition(side, partial);
    commit({
      ...artwork,
      [side]: {
        ...current,
        width: nextPosition.widthCm,
        height: nextPosition.heightCm,
        fromNeck: nextPosition.fromNeckCm,
        fromCenter: nextPosition.fromCenterCm,
        ...artworkOverrides,
      },
    });
    onViewChange?.(side);
  }

  function restoreRecommendedPlacement(side: Side) {
    const current = artwork[side];
    if (!current) return;
    const printArea = PRINT_AREA_SIZE_CHART[current.printArea];
    const fitted = fitWithin(current, printArea.width, printArea.height);

    applyPlacement(
      side,
      {
        ...DEFAULT_POSITION_STATE,
        ...fitted,
        fromNeckCm: 5,
        fromCenterCm: 0,
      },
      {
        guidelines: {
          ...current.guidelines,
          maximumArea: true,
          leftChest: false,
        },
      }
    );
    trackConfiguratorEvent("artwork_placement_reset", { side });
  }

  function applyLeftChestPreset(side: Side) {
    const current = artwork[side];
    if (!current) return;
    const fitted = fitWithin(
      current,
      LEFT_CHEST_DIMENSIONS.width,
      LEFT_CHEST_DIMENSIONS.height,
      LEFT_CHEST_DIMENSIONS.width
    );

    applyPlacement(
      side,
      {
        ...fitted,
        alignH: null,
        alignV: null,
        aspectLocked: true,
        fromNeckCm: 5,
        fromCenterCm: LEFT_CHEST_FROM_CENTER_CM,
      },
      {
        guidelines: {
          ...current.guidelines,
          maximumArea: true,
          leftChest: true,
        },
      }
    );
    trackConfiguratorEvent("artwork_left_chest_applied", { side });
  }

  function copyFrontArtworkToBack() {
    const front = artwork.front;
    if (!front || artwork.back) return;

    const back: ArtworkSide = {
      ...front,
      guidelines: { ...front.guidelines },
      confirmed: false,
    };
    commit({ ...artwork, back });
    updatePosition("back", {
      widthCm: front.width,
      heightCm: front.height,
      fromNeckCm: front.fromNeck,
      fromCenterCm: front.fromCenter,
      aspectLocked: true,
    });
    setAdjustingSide("back");
    onViewChange?.("back");
    trackConfiguratorEvent("artwork_copied_to_back");
  }

  function renderAdjustPanel(side: Side, current: ArtworkSide) {
    if (adjustingSide !== side) return null;
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-[#ECE7DF] bg-[var(--color-cream-soft)] p-3">
        <p className="text-xs text-[#111111]/55">
          Drag or resize the box on the {SIDE_LABELS[side].toLowerCase()} preview, or use these controls for precise placement. Every change is saved automatically.
        </p>
        <ArtworkAreaSizeSelect
          value={current.printArea}
          onChange={(size) => handlePrintAreaChange(side, size)}
        />
        <div className="flex flex-wrap gap-2" aria-label={`${SIDE_LABELS[side]} placement presets`}>
          <button
            type="button"
            onClick={() => restoreRecommendedPlacement(side)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#DED8CE] bg-white px-3 py-1.5 text-xs font-semibold text-[#111111]/70 hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"
          >
            <RotateCcw size={13} strokeWidth={2.2} />
            Restore recommended centre
          </button>
          <button
            type="button"
            onClick={() => applyLeftChestPreset(side)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#DED8CE] bg-white px-3 py-1.5 text-xs font-semibold text-[#111111]/70 hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"
          >
            <MapPin size={13} strokeWidth={2.2} />
            Apply left-chest preset
          </button>
        </div>
        <PositionControls />
        <GuidelinesToggles
          printAreaDimensions={PRINT_AREA_SIZE_CHART[current.printArea]}
          maximumArea={current.guidelines.maximumArea}
          leftChest={current.guidelines.leftChest}
          onMaximumAreaChange={(value) =>
            handleGuidelineChange(side, "maximumArea", value)
          }
          onLeftChestChange={(value) =>
            handleGuidelineChange(side, "leftChest", value)
          }
        />
      </div>
    );
  }

  function renderSide(side: Side) {
    const current = artwork[side];
    const isReady = Boolean(current?.fileUrl && current.technique);

    return (
      <section className="flex flex-col gap-2 rounded-2xl border border-[#ECE7DF] p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#111111]/70">
              {SIDE_LABELS[side]}
            </p>
            <p className="mt-0.5 text-[11px] text-[#111111]/50">
              {isReady && current?.technique
                ? `${TECHNIQUE_LABELS[current.technique]} selected - saved automatically`
                : "Optional - upload only when you need branding on this side"}
            </p>
          </div>
          {isReady && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF7EA] px-2 py-1 text-[10px] font-semibold text-[#1B7F36]">
              <CheckCircle2 size={12} strokeWidth={2.4} />
              Ready for review
            </span>
          )}
        </div>

        <ArtworkUploadSide
          side={side}
          value={current}
          onChange={(next) => handleSideChange(side, next)}
        />

        {current && (
          <>
            <TechniqueSelect
              value={current.technique}
              fileType={current.fileType}
              onChange={(technique) => handleTechniqueChange(side, technique)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleAdjusting(side)}
                aria-expanded={adjustingSide === side}
                className={`flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  adjustingSide === side
                    ? "border-[var(--color-teal)] bg-[var(--color-teal)] text-white"
                    : "border-[#E5E5E5] text-[#111111]/70 hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"
                }`}
              >
                <SlidersHorizontal size={13} strokeWidth={2.2} />
                {adjustingSide === side ? "Close adjustments" : "Adjust size & placement"}
              </button>
              {side === "front" && !artwork.back && (
                <button
                  type="button"
                  onClick={copyFrontArtworkToBack}
                  className="flex items-center gap-1.5 rounded-full border border-[#E5E5E5] px-3 py-1.5 text-xs font-semibold text-[#111111]/70 hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"
                >
                  <Copy size={13} strokeWidth={2.2} />
                  Copy to back
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSideChange(side, undefined)}
                className="flex items-center gap-1.5 rounded-full border border-[#F0DADA] px-3 py-1.5 text-xs font-semibold text-[#A63A3A] hover:bg-[#FFF5F5]"
              >
                <Trash2 size={13} strokeWidth={2.2} />
                Clear {SIDE_LABELS[side].toLowerCase()} side
              </button>
            </div>
            {renderAdjustPanel(side, current)}
          </>
        )}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-sm text-[#111111]">
      <div className="rounded-xl bg-[#F7F7F7] px-3 py-2 text-xs leading-relaxed text-[#111111]/60">
        Artwork is optional. Upload what you have, choose a technique or use our recommendation, then continue. Non-vector files are accepted and checked by the production team.
      </div>
      {renderSide("front")}
      {renderSide("back")}
    </div>
  );
}

export default ArtworkPanel;
