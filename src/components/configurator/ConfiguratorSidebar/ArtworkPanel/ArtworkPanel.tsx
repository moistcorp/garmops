"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Copy, Trash2 } from "lucide-react";
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
type PositionSeed = Pick<
  PositionControlsState,
  "widthCm" | "heightCm" | "fromNeckCm" | "fromCenterCm"
>;

const SIDE_LABELS: Record<Side, string> = {
  front: "Front",
  back: "Back",
};

export function ArtworkPanel({
  value,
  onChange,
  activeView,
  onViewChange,
}: ArtworkPanelProps = {}) {
  const [internalArtwork, setInternalArtwork] = useState<Artwork>(value ?? {});
  const [expandedSide, setExpandedSide] = useState<Side | null>(
    activeView === "back" ? "back" : "front"
  );
  const isControlled = value !== undefined;
  const artwork = isControlled ? value : internalArtwork;
  const { positions, updatePosition } = useArtworkPosition();
  const seededArtworkIdentityRef = useRef<Partial<Record<Side, string>>>({});
  const pendingPositionSeedRef = useRef<
    Partial<Record<Side, { identity: string; position: PositionSeed }>>
  >({});

  function commit(next: Artwork) {
    if (!isControlled) setInternalArtwork(next);
    onChange?.(next);
  }

  useEffect(() => {
    (["front", "back"] as Side[]).forEach((side) => {
      const current = artwork[side];
      const pos = positions[side];
      if (!current || !pos) {
        seededArtworkIdentityRef.current[side] = undefined;
        pendingPositionSeedRef.current[side] = undefined;
        return;
      }

      const identity = current.fileKey
        ? `key:${current.fileKey}`
        : `url:${current.fileUrl}`;
      const isSampleArtwork = current.fileUrl === SAMPLE_ARTWORK_HREF;
      const seed: PositionSeed = {
        widthCm: isSampleArtwork
          ? SAMPLE_ARTWORK_DIMENSIONS.width
          : current.width,
        heightCm: isSampleArtwork
          ? SAMPLE_ARTWORK_DIMENSIONS.height
          : current.height,
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
          },
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions.front, positions.back, artwork.front, artwork.back]);

  function handleSideChange(side: Side, next: ArtworkSide | undefined) {
    commit({ ...artwork, [side]: next });
  }

  function handleTechniqueChange(side: Side, technique: ArtworkTechnique) {
    const current = artwork[side];
    if (!current) return;
    const constrained = constrainArtworkToPrintArea(
      {
        ...positions[side],
        widthCm: current.width,
        heightCm: current.height,
        fromNeckCm: current.fromNeck,
        fromCenterCm: current.fromCenter,
      },
      PRINT_AREA_SIZE_CHART[current.printArea]
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

  function handlePrintAreaChange(side: Side, printArea: PrintAreaSize) {
    const current = artwork[side];
    if (!current) return;
    const constrained = constrainArtworkToPrintArea(
      {
        ...positions[side],
        widthCm: current.width,
        heightCm: current.height,
        fromNeckCm: current.fromNeck,
        fromCenterCm: current.fromCenter,
      },
      PRINT_AREA_SIZE_CHART[printArea]
    );
    updatePosition(side, constrained);
    commit({
      ...artwork,
      [side]: {
        ...current,
        printArea,
        width: constrained.widthCm,
        height: constrained.heightCm,
        fromNeck: constrained.fromNeckCm,
        fromCenter: constrained.fromCenterCm,
        guidelines: { ...current.guidelines, maximumArea: true },
      },
    });
    onViewChange?.(side);
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

  function copyArtworkToOtherSide(sourceSide: Side) {
    const destinationSide: Side = sourceSide === "front" ? "back" : "front";
    const source = artwork[sourceSide];
    if (!source || artwork[destinationSide]) return;

    const destination: ArtworkSide = {
      ...source,
      guidelines: { ...source.guidelines },
      confirmed: false,
    };
    commit({ ...artwork, [destinationSide]: destination });
    updatePosition(destinationSide, {
      widthCm: source.width,
      heightCm: source.height,
      fromNeckCm: source.fromNeck,
      fromCenterCm: source.fromCenter,
      aspectLocked: true,
    });
    onViewChange?.(destinationSide);
    setExpandedSide(destinationSide);
    trackConfiguratorEvent(
      destinationSide === "back"
        ? "artwork_copied_to_back"
        : "artwork_copied_to_front"
    );
  }

  function renderAdjustPanel(side: Side, current: ArtworkSide) {
    if (!current.technique) return null;
    return (
      <div
        className="configurator-glass-subtle flex flex-col gap-3 rounded-2xl p-3"
        onFocusCapture={() => onViewChange?.(side)}
        onPointerDownCapture={() => onViewChange?.(side)}
      >
        <PositionControls
          printAreaDimensions={PRINT_AREA_SIZE_CHART[current.printArea]}
          view={side}
        />
        <GuidelinesToggles
          maximumArea={current.guidelines.maximumArea}
          leftChest={current.guidelines.leftChest}
          onMaximumAreaChange={(value) =>
            handleGuidelineChange(side, "maximumArea", value)
          }
          onLeftChestChange={(value) =>
            handleGuidelineChange(side, "leftChest", value)
          }
        />
        {!artwork[side === "front" ? "back" : "front"] && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => copyArtworkToOtherSide(side)}
              className="configurator-glass-control flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold text-[#111111]/70 hover:!border-[var(--color-teal)]/45 hover:text-[var(--color-teal)]"
            >
              <Copy size={13} strokeWidth={2.2} />
              Copy to {side === "front" ? "back" : "front"}
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderSide(side: Side) {
    const current = artwork[side];
    const isReady = Boolean(current?.fileUrl && current.technique);
    const isExpanded = expandedSide === side;
    const contentId = `artwork-${side}-accordion-content`;

    return (
      <section className="configurator-glass-subtle overflow-hidden rounded-2xl p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={contentId}
            onClick={() => {
              setExpandedSide(isExpanded ? null : side);
              if (!isExpanded) onViewChange?.(side);
            }}
            className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/40"
          >
            <span className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-wide text-[#111111]/70">
                {SIDE_LABELS[side]}
              </span>
              {isReady && current?.technique && (
                <span className="mt-0.5 block truncate text-[11px] text-[#111111]/50">
                  {TECHNIQUE_LABELS[current.technique]} selected · saved automatically
                </span>
              )}
            </span>
            <span className="ml-auto flex shrink-0 items-center gap-2">
              {isReady && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF7EA] px-2 py-1 text-[10px] font-semibold text-[#1B7F36]">
                  <CheckCircle2 size={12} strokeWidth={2.4} />
                  Ready for review
                </span>
              )}
              <ChevronDown
                size={17}
                strokeWidth={2.2}
                aria-hidden="true"
                className={`text-[#111111]/45 transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </span>
          </button>
          {current && (
            <button
              type="button"
              aria-label={`Delete ${SIDE_LABELS[side].toLowerCase()} artwork`}
              title={`Delete ${SIDE_LABELS[side].toLowerCase()} artwork`}
              onClick={() => handleSideChange(side, undefined)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#C83E3E] transition-colors hover:bg-[#FFF0F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C83E3E]/30"
            >
              <Trash2 size={16} strokeWidth={2.2} />
            </button>
          )}
        </div>

        {isExpanded && (
          <div id={contentId} className="flex flex-col gap-2 pt-3">
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
                  side={side}
                  onChange={(technique) => handleTechniqueChange(side, technique)}
                />
                <ArtworkAreaSizeSelect
                  value={current.printArea}
                  onChange={(size) => handlePrintAreaChange(side, size)}
                />
                {renderAdjustPanel(side, current)}
              </>
            )}
          </div>
        )}
      </section>
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
