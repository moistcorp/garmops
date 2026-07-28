/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { ProductId } from "@/lib/configurator/pricing";
import type {
  Artwork,
  ArtworkSide,
  NeckLabel,
  NeckLabelDimensions,
  NeckLabelPosition,
} from "@/lib/configurator/types/configurator";
import type { GarmentView } from "@/lib/configurator/types/garment";
import {
  useArtworkPosition,
  CANVAS_PX,
  PX_PER_CM_X,
  PX_PER_CM_Y,
  PRINT_ORIGIN_PX,
  PRINT_AREA_TOP_OFFSET_CM,
  DRAGGABLE_VIEWS,
  constrainArtworkToPrintArea,
  resizeWithAspect,
} from "@/lib/configurator/ArtworkPositionContext";
import { PRINT_AREA_SIZE_CHART } from "@/lib/configurator/sizecharts";
import {
  LEFT_CHEST_DIMENSIONS,
  LEFT_CHEST_PLACEMENT,
} from "@/components/configurator/ConfiguratorSidebar/ArtworkPanel/GuidelinesToggles";
import GarmentComposite, { getDisplayPreviewHex } from "./GarmentComposite";

// Matches the small top margin PositionControls/the box default use as the
// garment's overall printable boundary — the guideline overlays anchor here
// rather than to the user's current (adjustable) artwork box position, since
// they represent a fixed manufacturing limit, not the artwork placement.
// Neck labels are internal details, so they render only in the dedicated
// close-up instead of floating above the garment in front/back views.
const NECK_LABEL_VIEWS = ["neck"] as const;
const SAMPLE_NECK_LABEL_HREF = "/garments/neck-label-sample.svg";
type NeckLabelView = (typeof NECK_LABEL_VIEWS)[number];

const BASE_GARMENT_INSET_PERCENT = 2;
const ENLARGED_GARMENT_INSET_PERCENT = -8.3;

const NECK_LABEL_PX_PER_MM: Record<NeckLabelView, number> = {
  neck: 2.4,
};
const NECK_LABEL_TOP_PERCENT: Record<NeckLabelView, Record<NeckLabelPosition, number>> = {
  neck: {
    below_neck_tape: 35, // hangs just under the neck binding, as a sewn-in tag
    on_neck_tape: 33, // sits directly over/on the binding tape itself
  },
};

// The 45x45mm preset has ~2x the on-canvas area of the strip presets (50x18,
// 60x20, 65x15) once scaled by the same px-per-mm factor, and being a tall
// square it visually dominates the collar in a way the physical size
// difference doesn't really justify. Scale it down relative to the others.
const NECK_LABEL_SCALE_OVERRIDE: Partial<Record<NeckLabelDimensions, number>> = {
  "45x45": 0.62,
};

function neckLabelSizeMultiplier(dimensions: NeckLabelDimensions): number {
  return NECK_LABEL_SCALE_OVERRIDE[dimensions] ?? 1;
}

function parseNeckLabelDimensionsMm(dimensions: NeckLabelDimensions): {
  widthMm: number;
  heightMm: number;
} {
  const [widthMm, heightMm] = dimensions.split("x").map(Number);
  return { widthMm, heightMm };
}

interface CanvasRendererProps {
  view: GarmentView;
  colourHex: string;
  productId: ProductId;
  artwork: Artwork;
  neckLabel?: NeckLabel;
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
  showProductionGuides?: boolean;
  exclusiveLayerCache?: boolean;
}

const CANVAS_SIZE = CANVAS_PX;

type DragMode = "move" | "resize";

function formatPlacementCm(value: number, signed = false): string {
  const normalized = Math.abs(value) < 0.05 ? 0 : value;
  const formatted = normalized.toFixed(1).replace(/\.0$/, "");
  return signed && normalized > 0 ? `+${formatted}` : formatted;
}

interface DragOrigin {
  mode: DragMode;
  pointerX: number;
  pointerY: number;
  startWidthCm: number;
  startHeightCm: number;
  startFromNeckCm: number;
  startFromCenterCm: number;
}

function getGarmentFolder(productId: ProductId): string | null {
  if (productId.includes("canvas-tote")) return "canvas-tote-bag";
  if (productId.includes("boxy-fit-hoodie")) return "boxy-fit-hoodie";
  if (productId.includes("regular-fit-hoodie")) return "regular-fit-hoodie";
  if (productId.includes("regular-fit-sweatshirt")) return "regular-fit-sweatshirt";
  if (productId.includes("longsleeve")) return "longsleeve-tee";
  if (productId.includes("polo")) return "polo";
  if (productId.includes("boxy-fit-tee")) return "boxy-fit-tee";
  if (productId.includes("regular-fit-tee")) return "regular-fit-tee";
  return null;
}

function assetPath(productId: ProductId, view: GarmentView, layer: string): string {
  const garmentFolder = getGarmentFolder(productId);
  if (!garmentFolder) return "";

  // Both hoodie styles use the same neck artwork, so keep only one copy.
  const assetFolder =
    view === "neck" && garmentFolder === "regular-fit-hoodie"
      ? "boxy-fit-hoodie"
      : garmentFolder;
  const extension = layer === "mask" ? "png" : "webp";

  return `/garments/${assetFolder}/${view}/${layer}.${extension}`;
}

function isRenderableImage(fileUrl?: string, fileType?: ArtworkSide["fileType"]): boolean {
  if (!fileUrl || fileType === "ai") return false;
  return /\.(png|jpe?g|svg|webp)$/i.test(fileUrl) || fileUrl.startsWith("blob:");
}

// Neck labels are restricted to .svg/.ai uploads (see NeckLabel type). Unlike
// the general ArtworkPreview check above, a blob: url alone isn't enough
// here — an .ai upload also gets a blob: url but a browser can't rasterize
// PostScript/PDF content inside an <img>, so we key off the tracked
// fileType instead and only ever try to render actual .svg files.
function isRenderableNeckLabel(neckLabel: NeckLabel): boolean {
  return (
    neckLabel.fileType === "svg" &&
    Boolean(neckLabel.fileUrl) &&
    (neckLabel.fileUrl !== SAMPLE_NECK_LABEL_HREF || neckLabel.source === "sample")
  );
}

function ArtworkPreview({ side }: { side: ArtworkSide }) {
  if (isRenderableImage(side.fileUrl, side.fileType)) {
    return (
      <img
        src={side.fileUrl}
        alt=""
        draggable={false}
        className="h-full w-full object-contain"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-white/80 px-2 text-center text-xs font-semibold uppercase tracking-wide text-[#111111]/55">
      {side.fileType} Artwork
    </div>
  );
}

// Renders the neck label as a stitched fabric tag: white patch, the
// uploaded artwork (svg only — see isRenderableNeckLabel), and a stitch-line
// overlay that reflects the selected stitch type. Built as one SVG so the
// stitching stays crisp and proportional as the box resizes with the
// dimension preset, rather than layering separate DOM borders.
function NeckLabelPreview({ neckLabel }: { neckLabel: NeckLabel }) {
  const { widthMm, heightMm } = parseNeckLabelDimensionsMm(neckLabel.dimensions);
  // preserveAspectRatio="none" below stretches this SVG to fill whatever box
  // the parent gives it, so this scale only sets the internal coordinate
  // system (stroke widths, corner-tick length, font size) — it doesn't
  // affect the label's actual on-screen size, which is controlled per-view
  // in neckLabelBoxStyle.
  const w = widthMm * NECK_LABEL_PX_PER_MM.neck;
  const h = heightMm * NECK_LABEL_PX_PER_MM.neck;
  const renderable = isRenderableNeckLabel(neckLabel);
  const stitchColor = "#111111";

  // Stitch type only applies to a "below neck tape" hang-tag — an "on neck
  // tape" label is sewn flush into the tape on all four sides instead.
  const stitch = neckLabel.position === "below_neck_tape" ? neckLabel.stitch : undefined;
  const cornerBarTack = Math.min(w * 0.12, h * 0.5);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-full w-full overflow-visible drop-shadow-sm"
      preserveAspectRatio="none"
      role="img"
      aria-label="Neck label preview"
    >
      <rect
        x={0.5}
        y={0.5}
        width={w - 1}
        height={h - 1}
        fill="#FFFFFF"
        stroke="#111111"
        strokeOpacity={0.25}
        strokeWidth={1}
      />

      {renderable ? (
        <image
          href={neckLabel.fileUrl}
          x={w * 0.1}
          y={h * 0.1}
          width={w * 0.8}
          height={h * 0.8}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : !neckLabel.fileUrl || neckLabel.fileUrl === SAMPLE_NECK_LABEL_HREF ? null : (
        <text
          x={w / 2}
          y={h / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={Math.min(w, h) * 0.15}
          fontWeight={700}
          fill="#111111"
          opacity={0.45}
        >
          {neckLabel.fileType === "ai" ? "AI FILE" : "LABEL"}
        </text>
      )}

      {/* On-tape labels are stitched flush around all four edges. */}
      {neckLabel.position === "on_neck_tape" && (
        <rect
          x={1}
          y={1}
          width={w - 2}
          height={h - 2}
          fill="none"
          stroke={stitchColor}
          strokeWidth={1.2}
          strokeDasharray="3 2"
        />
      )}

      {/* Below-tape hang-tags: stitched down the two sides only. */}
      {stitch === "2_side" && (
        <>
          <line x1={1} y1={0} x2={1} y2={h} stroke={stitchColor} strokeWidth={1.2} strokeDasharray="3 2" />
          <line x1={w - 1} y1={0} x2={w - 1} y2={h} stroke={stitchColor} strokeWidth={1.2} strokeDasharray="3 2" />
        </>
      )}

      {/* Two-corner labels use short horizontal bar-tacks crossing the upper
          corners, matching how the physical label is attached. */}
      {(stitch === "2_corner" || stitch === "4_corner") && (
        <>
          <line
            x1={-cornerBarTack * 0.55}
            y1={1.5}
            x2={cornerBarTack * 0.45}
            y2={1.5}
            stroke={stitchColor}
            strokeWidth={1.6}
            strokeDasharray="2 1"
            strokeLinecap="round"
          />
          <line
            x1={w - cornerBarTack * 0.45}
            y1={1.5}
            x2={w + cornerBarTack * 0.55}
            y2={1.5}
            stroke={stitchColor}
            strokeWidth={1.6}
            strokeDasharray="2 1"
            strokeLinecap="round"
          />
        </>
      )}

      {/* Four-corner labels repeat those horizontal bar-tacks at the bottom. */}
      {stitch === "4_corner" && (
        <>
          <line
            x1={-cornerBarTack * 0.55}
            y1={h - 1.5}
            x2={cornerBarTack * 0.45}
            y2={h - 1.5}
            stroke={stitchColor}
            strokeWidth={1.6}
            strokeDasharray="2 1"
            strokeLinecap="round"
          />
          <line
            x1={w - cornerBarTack * 0.45}
            y1={h - 1.5}
            x2={w + cornerBarTack * 0.55}
            y2={h - 1.5}
            stroke={stitchColor}
            strokeWidth={1.6}
            strokeDasharray="2 1"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

export default function CanvasRenderer({
  view,
  colourHex,
  productId,
  artwork,
  neckLabel,
  interactive = true,
  className = "aspect-square h-[min(78dvh,820px)] max-h-[820px] max-w-full rounded-lg bg-[#F5F5F5]",
  style,
  showProductionGuides = true,
  exclusiveLayerCache = false,
}: CanvasRendererProps) {
  const { positions, updatePosition } = useArtworkPosition();
  const dragOrigin = useRef<DragOrigin | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [dragMode, setDragMode] = useState<DragMode | null>(null);
  const garmentFolder = getGarmentFolder(productId);

  const showBox = DRAGGABLE_VIEWS.includes(view);
  const activeArtwork = view === "front" ? artwork.front : view === "back" ? artwork.back : undefined;
  const boxState =
    !interactive && activeArtwork
      ? {
          ...positions[view],
          widthCm: activeArtwork.width,
          heightCm: activeArtwork.height,
          fromNeckCm: activeArtwork.fromNeck,
          fromCenterCm: activeArtwork.fromCenter,
        }
      : positions[view];
  const isNeckLabelView = (v: GarmentView): v is NeckLabelView =>
    (NECK_LABEL_VIEWS as readonly GarmentView[]).includes(v);
  const showNeckLabel =
    isNeckLabelView(view) &&
    Boolean(
      neckLabel?.dimensions &&
        neckLabel?.position &&
        (neckLabel.fileUrl || view === "neck")
    );

  let neckLabelBoxStyle: { left: string; top: string; width: string; height: string; transform: string } | undefined;
  if (showNeckLabel && neckLabel?.dimensions && isNeckLabelView(view)) {
    const { widthMm, heightMm } = parseNeckLabelDimensionsMm(neckLabel.dimensions);
    const scale = NECK_LABEL_PX_PER_MM[view] * neckLabelSizeMultiplier(neckLabel.dimensions);
    const labelWidthPx = widthMm * scale;
    const labelHeightPx = heightMm * scale;
    neckLabelBoxStyle = {
      left: "50%",
      top: `${NECK_LABEL_TOP_PERCENT[view][neckLabel.position]}%`,
      width: `${(labelWidthPx / CANVAS_SIZE.width) * 100}%`,
      height: `${(labelHeightPx / CANVAS_SIZE.height) * 100}%`,
      transform: "translateX(-50%)",
    };
  }

  const boxWidthPx = boxState.widthCm * PX_PER_CM_X;
  const boxHeightPx = boxState.heightCm * PX_PER_CM_Y;
  const boxLeftPx = PRINT_ORIGIN_PX.x + boxState.fromCenterCm * PX_PER_CM_X - boxWidthPx / 2;
  const boxTopPx = PRINT_ORIGIN_PX.y + boxState.fromNeckCm * PX_PER_CM_Y;

  // Print guideline overlays (maximum printable area / left-chest reference),
  // anchored to the garment's fixed boundaries rather than the user's
  // adjustable artwork box.
  const printAreaDims = activeArtwork
    ? PRINT_AREA_SIZE_CHART[activeArtwork.printArea]
    : undefined;
  const canEditArtwork = Boolean(
    interactive &&
      showProductionGuides &&
      showBox &&
      activeArtwork?.technique &&
      printAreaDims
  );
  const showMaxArea = showProductionGuides && interactive && showBox && !!activeArtwork?.guidelines.maximumArea && !!printAreaDims;
  const showLeftChest = showProductionGuides && interactive && showBox && !!activeArtwork?.guidelines.leftChest;

  const maxAreaWidthPx = printAreaDims ? printAreaDims.width * PX_PER_CM_X : 0;
  const maxAreaHeightPx = printAreaDims ? printAreaDims.height * PX_PER_CM_Y : 0;
  const maxAreaLeftPx = PRINT_ORIGIN_PX.x - maxAreaWidthPx / 2;
  const maxAreaTopPx = PRINT_ORIGIN_PX.y + PRINT_AREA_TOP_OFFSET_CM * PX_PER_CM_Y;

  const chestWidthPx = LEFT_CHEST_DIMENSIONS.width * PX_PER_CM_X;
  const chestHeightPx = LEFT_CHEST_DIMENSIONS.height * PX_PER_CM_Y;
  const chestLeftPx =
    PRINT_ORIGIN_PX.x +
    LEFT_CHEST_PLACEMENT.fromCenterCm * PX_PER_CM_X -
    chestWidthPx / 2;
  const chestTopPx =
    PRINT_ORIGIN_PX.y +
    LEFT_CHEST_PLACEMENT.fromNeckCm * PX_PER_CM_Y;

  const handlePointerMove = (e: PointerEvent) => {
    const origin = dragOrigin.current;
    if (!origin || !printAreaDims) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    // Convert screen pixels back into the renderer's fixed 600×600 design
    // coordinate space before applying the cm scale. This keeps movement and
    // resizing consistent when the desktop window/canvas is resized.
    const dCanvasPxX = (e.clientX - origin.pointerX) * (CANVAS_SIZE.width / rect.width);
    const dCanvasPxY = (e.clientY - origin.pointerY) * (CANVAS_SIZE.height / rect.height);
    const originState = {
      ...boxState,
      widthCm: origin.startWidthCm,
      heightCm: origin.startHeightCm,
      fromNeckCm: origin.startFromNeckCm,
      fromCenterCm: origin.startFromCenterCm,
      alignH: null,
      alignV: null,
    };

    if (origin.mode === "move") {
      updatePosition(
        view,
        constrainArtworkToPrintArea(
          {
            ...originState,
            fromCenterCm:
              origin.startFromCenterCm + dCanvasPxX / PX_PER_CM_X,
            fromNeckCm:
              origin.startFromNeckCm + dCanvasPxY / PX_PER_CM_Y,
          },
          printAreaDims
        )
      );
      return;
    }

    const resized = resizeWithAspect(
      originState,
      "height",
      origin.startHeightCm + dCanvasPxY / PX_PER_CM_Y
    );
    updatePosition(
      view,
      constrainArtworkToPrintArea(
        { ...originState, ...resized },
        printAreaDims
      )
    );
  };

  const handleCanvasKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!canEditArtwork || !printAreaDims) return;
    const step = event.shiftKey ? 1 : 0.5;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      if (event.altKey) {
        const delta = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -step : step;
        updatePosition(
          view,
          constrainArtworkToPrintArea(
            {
              ...boxState,
              ...resizeWithAspect(
                boxState,
                "width",
                boxState.widthCm + delta
              ),
              alignH: null,
              alignV: null,
            },
            printAreaDims
          )
        );
        return;
      }
      updatePosition(
        view,
        constrainArtworkToPrintArea(
          {
            ...boxState,
            alignH: null,
            alignV: null,
            fromCenterCm:
              event.key === "ArrowLeft"
                ? boxState.fromCenterCm - step
                : event.key === "ArrowRight"
                  ? boxState.fromCenterCm + step
                  : boxState.fromCenterCm,
            fromNeckCm:
              event.key === "ArrowUp"
                ? boxState.fromNeckCm - step
                : event.key === "ArrowDown"
                  ? boxState.fromNeckCm + step
                  : boxState.fromNeckCm,
          },
          printAreaDims
        )
      );
    }
  };

  const handlePointerUp = () => {
    dragOrigin.current = null;
    setDragMode(null);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  };

  const handleDragStart = (e: ReactPointerEvent<HTMLDivElement>, mode: DragMode) => {
    if (!canEditArtwork) return;
    e.preventDefault();
    e.stopPropagation();
    setDragMode(mode);
    dragOrigin.current = {
      mode,
      pointerX: e.clientX,
      pointerY: e.clientY,
      startWidthCm: boxState.widthCm,
      startHeightCm: boxState.heightCm,
      startFromNeckCm: boxState.fromNeckCm,
      startFromCenterCm: boxState.fromCenterCm,
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <div
      ref={canvasRef}
      className={`relative ${
        view === "front" || view === "back"
          ? "overflow-visible"
          : "overflow-hidden"
      } ${className}`}
      style={style}
      tabIndex={canEditArtwork ? 0 : undefined}
      onKeyDown={handleCanvasKeyDown}
      aria-label={
        canEditArtwork
          ? `${view} garment preview. Use arrow keys to move artwork; Alt plus arrow keys resize it.`
          : `${view} garment preview`
      }
    >
      {!garmentFolder && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#F7F7F7] p-6 text-center text-sm font-semibold text-[#C62828]">
          Preview assets are not mapped for this product.
        </div>
      )}
      <div
        className="absolute"
        style={{
          inset:
            view === "front" || view === "back"
              ? `${ENLARGED_GARMENT_INSET_PERCENT}%`
              : `${BASE_GARMENT_INSET_PERCENT}%`,
        }}
      >
        {/* Immediate colour fallback while the detail-rich canvas composite loads. */}
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: getDisplayPreviewHex(colourHex),
            WebkitMaskImage: `url(${assetPath(productId, view, "mask")})`,
            maskImage: `url(${assetPath(productId, view, "mask")})`,
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        />
        <GarmentComposite
          maskSrc={assetPath(productId, view, "mask")}
          textureSrc={assetPath(productId, view, "texture")}
          shadowSrc={assetPath(productId, view, "shadow")}
          highlightSrc={assetPath(productId, view, "highlight")}
          colourHex={colourHex}
          cacheScope={garmentFolder ?? productId}
          exclusiveCacheScope={exclusiveLayerCache}
        />
      </div>

      {activeArtwork && (
        <div
          onPointerDown={(e) => handleDragStart(e, "move")}
          className={`absolute z-20 ${
            canEditArtwork ? "cursor-move touch-none" : "pointer-events-none"
          }`}
          style={{
            left: `${(boxLeftPx / CANVAS_SIZE.width) * 100}%`,
            top: `${(boxTopPx / CANVAS_SIZE.height) * 100}%`,
            width: `${(boxWidthPx / CANVAS_SIZE.width) * 100}%`,
            height: `${(boxHeightPx / CANVAS_SIZE.height) * 100}%`,
          }}
        >
          <ArtworkPreview side={activeArtwork} />
          {showBox && canEditArtwork && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 border border-[#B534CC]"
            />
          )}
          {showBox && canEditArtwork && (
            <div
              role="presentation"
              onPointerDown={(e) => handleDragStart(e, "resize")}
              className="absolute -bottom-5 left-1/2 z-20 h-3 w-3 -translate-x-1/2 cursor-ns-resize rounded-full bg-[#B534CC] ring-1 ring-white/90"
            />
          )}
          {dragMode && (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute left-1/2 top-[calc(100%+30px)] z-30 min-w-max -translate-x-1/2 rounded-xl border border-white/65 bg-[#111111]/78 px-3 py-2 font-sans text-[11px] font-semibold leading-4 text-white shadow-lg backdrop-blur-md"
            >
              {dragMode === "move" ? (
                <>
                  <span className="block">
                    Centre: {formatPlacementCm(boxState.fromCenterCm, true)} cm
                  </span>
                  <span className="block">
                    From neck: {formatPlacementCm(boxState.fromNeckCm)} cm
                  </span>
                </>
              ) : (
                <>
                  <span className="block">
                    Width: {formatPlacementCm(boxState.widthCm)} cm
                  </span>
                  <span className="block">
                    Height: {formatPlacementCm(boxState.heightCm)} cm
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {showNeckLabel && neckLabel && neckLabelBoxStyle && (
        <div className="absolute z-10" style={neckLabelBoxStyle}>
          <NeckLabelPreview neckLabel={neckLabel} />
        </div>
      )}

      {showMaxArea && (
        <div
          role="presentation"
          aria-label="Maximum print area guideline"
          className="pointer-events-none absolute z-[15] border border-dashed border-[#B534CC]/60"
          style={{
            left: `${(maxAreaLeftPx / CANVAS_SIZE.width) * 100}%`,
            top: `${(maxAreaTopPx / CANVAS_SIZE.height) * 100}%`,
            width: `${(maxAreaWidthPx / CANVAS_SIZE.width) * 100}%`,
            height: `${(maxAreaHeightPx / CANVAS_SIZE.height) * 100}%`,
          }}
        />
      )}

      {showProductionGuides &&
        interactive &&
        showBox &&
        activeArtwork &&
        dragMode === "move" && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[12%] left-1/2 top-[20%] z-[14] border-l border-dashed border-[#B534CC]/60"
          />
      )}

      {showLeftChest && (
        <div
          role="presentation"
          aria-label="Left chest print guideline"
          className="pointer-events-none absolute z-[15] border border-dashed border-[#B534CC]/60"
          style={{
            left: `${(chestLeftPx / CANVAS_SIZE.width) * 100}%`,
            top: `${(chestTopPx / CANVAS_SIZE.height) * 100}%`,
            width: `${(chestWidthPx / CANVAS_SIZE.width) * 100}%`,
            height: `${(chestHeightPx / CANVAS_SIZE.height) * 100}%`,
          }}
        />
      )}

    </div>
  );
}
