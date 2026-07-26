"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, SlidersHorizontal, Trash2 } from "lucide-react";
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

export function ArtworkPanel({ value, onChange, onViewChange }: ArtworkPanelProps = {}) {
  const [internalArtwork, setInternalArtwork] = useState<Artwork>(value ?? {});
  const isControlled = value !== undefined;
  const artwork = isControlled ? value : internalArtwork;
  const [adjustingSide, setAdjustingSide] = useState<Side | null>(null);
  const { positions } = useArtworkPosition();

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
              <button
                type="button"
                onClick={() => handleSideChange(side, undefined)}
                className="flex items-center gap-1.5 rounded-full border border-[#F0DADA] px-3 py-1.5 text-xs font-semibold text-[#A63A3A] hover:bg-[#FFF5F5]"
              >
                <Trash2 size={13} strokeWidth={2.2} />
                Remove {SIDE_LABELS[side].toLowerCase()}
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
