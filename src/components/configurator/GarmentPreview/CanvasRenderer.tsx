"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { ProductId } from "@/lib/configurator/pricing";
import type {
  Artwork,
  ArtworkSide,
  CustomerArtworkTechnique,
  NeckLabel,
  NeckLabelDimensions,
  NeckLabelPosition,
} from "@/lib/configurator/types/configurator";
import { isCustomerArtworkTechnique } from "@/lib/configurator/types/configurator";
import { isCustomNeckLabel } from "@/lib/configurator/neckLabel";
import type { GarmentView } from "@/lib/configurator/types/garment";
import {
  useArtworkPosition,
  CANVAS_PX,
  PX_PER_CM_X,
  PX_PER_CM_Y,
  PRINT_ORIGIN_PX,
  DRAGGABLE_VIEWS,
  constrainArtworkToPrintArea,
  resizeWithAspect,
} from "@/lib/configurator/ArtworkPositionContext";
import type { PositionControlsState } from "@/lib/configurator/ArtworkPositionContext";
import { getGarmentInsetPercent, getGarmentPrintArea } from "@/lib/configurator/garmentGeometry";
import {
  LEFT_CHEST_DIMENSIONS,
  LEFT_CHEST_PLACEMENT,
} from "@/components/configurator/ConfiguratorSidebar/ArtworkPanel/GuidelinesToggles";
import GarmentComposite, {
  getDisplayPreviewHex,
  type GarmentCompositeRenderProgress,
} from "./GarmentComposite";
import {
  garmentAssetPath,
  getGarmentFolder,
  getGarmentRenderConfig,
} from "./garmentAssets";
import { useGarmentAssetPrefetch } from "./useGarmentAssetPrefetch";
import ArtworkMaterialCanvas from "./ArtworkMaterialCanvas";
import { garmentAssetUrl } from "@/lib/publicAssets";
import { uploadReadableAssetUrl } from "@/lib/configurator/sampleAssets";

// Matches the small top margin PositionControls/the box default use as the
// garment's overall printable boundary — the guideline overlays anchor here
// rather than to the user's current (adjustable) artwork box position, since
// they represent a fixed manufacturing limit, not the artwork placement.
// Neck labels are internal details, so they render only in the dedicated
// close-up instead of floating above the garment in front/back views.
const NECK_LABEL_VIEWS = ["neck"] as const;
const SAMPLE_NECK_LABEL_HREF = garmentAssetUrl("neck-label-sample.svg");
type NeckLabelView = (typeof NECK_LABEL_VIEWS)[number];

const NECK_LABEL_PX_PER_MM: Record<NeckLabelView, number> = {
  neck: 2.4,
};
const NECK_LABEL_TOP_PERCENT: Record<NeckLabelView, Record<NeckLabelPosition, number>> = {
  neck: {
    below_neck_tape: 35, // hangs just under the neck binding, as a sewn-in tag
    on_neck_tape: 33, // sits directly over/on the binding tape itself
  },
};

const TOTE_LABEL_TOP_PERCENT: Record<NeckLabelView, Record<NeckLabelPosition, number>> = {
  neck: {
    below_neck_tape: 55, // Assembly reference: label hangs 2 cm below the top seam
    on_neck_tape: 42, // overlaps the inner seam instead of floating between the handles
  },
};

// Standard labels are compact printed size tags, not custom-branding labels.
// Keep this preview-only size separate from the persisted custom-label presets.
const STANDARD_SIZE_LABEL_PREVIEW_MM = {
  widthMm: 15,
  heightMm: 20,
} as const;

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
  neckLabelPreviewUrl?: string;
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
  showProductionGuides?: boolean;
  exclusiveLayerCache?: boolean;
  onGarmentRenderProgress?: (result: GarmentRenderResult) => void;
}

export interface GarmentRenderResult {
  productId: ProductId;
  view: GarmentView;
  colourHex: string;
  state: GarmentCompositeRenderProgress["state"];
  loadedLayers: number;
  totalLayers: number;
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

function isRenderableImage(fileUrl?: string, fileType?: ArtworkSide["fileType"], previewKind?: ArtworkSide["previewKind"]): boolean {
  if (!fileUrl) return false;
  if (previewKind === "raster" || previewKind === "vector") return true;
  if (fileType === "ai" || fileType === "pdf") return false;
  return /\.(png|jpe?g|svg|webp)$/i.test(fileUrl) || fileUrl.startsWith("blob:");
}

function ArtworkTechniquePrompt() {
  return (
    <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-(--text-primary)/38">
      <span>Choose a print method to preview your artwork</span>
    </div>
  );
}

// Neck labels are restricted to .svg/.ai uploads (see NeckLabel type). SVG
// files can be displayed through the existing image/object-URL path. AI files
// use the separate, safe PNG derivative supplied by the upload panel.
function isRenderableNeckLabel(neckLabel: NeckLabel, previewUrl?: string): boolean {
  return (
    isCustomNeckLabel(neckLabel) &&
    Boolean(previewUrl || neckLabel.fileUrl) &&
    (Boolean(previewUrl) || neckLabel.fileType === "svg") &&
    (neckLabel.fileUrl !== SAMPLE_NECK_LABEL_HREF || neckLabel.source === "sample")
  );
}

// Renders the neck label as a stitched fabric tag: white patch, the
// uploaded artwork (svg only — see isRenderableNeckLabel), and a stitch-line
// overlay that reflects the selected stitch type. Built as one SVG so the
// stitching stays crisp and proportional as the box resizes with the
// dimension preset, rather than layering separate DOM borders.
function NeckLabelPreview({
  neckLabel,
  previewUrl,
}: {
  neckLabel: NeckLabel;
  previewUrl?: string;
}) {
  const standard = !isCustomNeckLabel(neckLabel);
  const { widthMm, heightMm } = standard
    ? STANDARD_SIZE_LABEL_PREVIEW_MM
    : parseNeckLabelDimensionsMm(neckLabel.dimensions);
  // This scale sets the internal coordinate system (stroke widths,
  // corner-tick length, font size). The matching outer box below controls the
  // label's actual on-screen size without changing these proportions.
  const w = widthMm * NECK_LABEL_PX_PER_MM.neck;
  const h = heightMm * NECK_LABEL_PX_PER_MM.neck;
  const renderable = isRenderableNeckLabel(neckLabel, previewUrl);
  // Rendering data, not UI text: stitches and fallback label artwork are intentionally near-black.
  const stitchColor = "#111111";

  // Stitch type only applies to a "below neck tape" hang-tag — an "on neck
  // tape" label is sewn flush into the tape on all four sides instead.
  const stitch = neckLabel.position === "below_neck_tape" ? neckLabel.stitch : undefined;
  const cornerBarTack = Math.min(w * 0.12, h * 0.5);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-full w-full overflow-visible drop-"
      preserveAspectRatio="xMidYMid meet"
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

      {!standard && renderable ? (
        <image
          href={previewUrl || neckLabel.fileUrl}
          x={w * 0.1}
          y={h * 0.1}
          width={w * 0.8}
          height={h * 0.8}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : !isCustomNeckLabel(neckLabel) || !neckLabel.fileUrl || neckLabel.fileUrl === SAMPLE_NECK_LABEL_HREF ? null : (
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
          {neckLabel.fileType === "ai" ? "Preview unavailable" : "Artwork preview unavailable"}
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
  neckLabelPreviewUrl,
  interactive = true,
  className = "aspect-square h-[min(78dvh,820px)] max-h-[820px] max-w-full rounded-sm bg-[#F5F5F5]",
  style,
  showProductionGuides = true,
  exclusiveLayerCache = false,
  onGarmentRenderProgress,
}: CanvasRendererProps) {
  const { positions, updatePosition } = useArtworkPosition();
  const dragOrigin = useRef<DragOrigin | null>(null);
  const dragPositionRef = useRef<PositionControlsState | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [dragMode, setDragMode] = useState<DragMode | null>(null);
  const [dragPosition, setDragPosition] = useState<PositionControlsState | null>(null);
  const garmentFolder = getGarmentFolder(productId);
  const garmentRenderConfig = getGarmentRenderConfig(productId, view);
  const isToteProduct = productId.includes("tote");
  useGarmentAssetPrefetch(productId, view);

  const handleGarmentRenderProgress = useCallback(
    (progress: GarmentCompositeRenderProgress) => {
      onGarmentRenderProgress?.({ productId, view, colourHex, ...progress });
    },
    [colourHex, onGarmentRenderProgress, productId, view],
  );

  const garmentInsetPercent = getGarmentInsetPercent(productId, view);

  const showBox = DRAGGABLE_VIEWS.includes(view);
  const activeArtwork = view === "front" ? artwork.front : view === "back" ? artwork.back : undefined;
  const boxState = useMemo(
    () =>
      !interactive && activeArtwork
        ? {
            ...positions[view],
            widthCm: activeArtwork.width,
            heightCm: activeArtwork.height,
            fromNeckCm: activeArtwork.fromNeck,
            fromCenterCm: activeArtwork.fromCenter,
          }
        : positions[view],
    [activeArtwork, interactive, positions, view],
  );
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
    const standard = !isCustomNeckLabel(neckLabel);
    const { widthMm, heightMm } = standard
      ? STANDARD_SIZE_LABEL_PREVIEW_MM
      : parseNeckLabelDimensionsMm(neckLabel.dimensions);
    const scale = NECK_LABEL_PX_PER_MM[view];
    const labelWidthPx = widthMm * scale;
    const labelHeightPx = heightMm * scale;
    neckLabelBoxStyle = {
      left: "50%",
      top: `${(isToteProduct ? TOTE_LABEL_TOP_PERCENT : NECK_LABEL_TOP_PERCENT)[view][neckLabel.position]}%`,
      width: `${(labelWidthPx / CANVAS_SIZE.width) * 100}%`,
      height: `${(labelHeightPx / CANVAS_SIZE.height) * 100}%`,
      transform: "translateX(-50%)",
    };
  }

  // Print guideline overlays and artwork constraints use the same calibrated
  // garment-relative area. The dedicated neck view intentionally has none.
  const printAreaDims = activeArtwork
    ? getGarmentPrintArea(productId, view, garmentInsetPercent)
    : undefined;
  const renderBoxState = printAreaDims
    ? constrainArtworkToPrintArea(boxState, printAreaDims)
    : boxState;
  const displayBoxState = dragPosition ?? renderBoxState;
  const boxWidthPx = displayBoxState.widthCm * PX_PER_CM_X;
  const boxHeightPx = displayBoxState.heightCm * PX_PER_CM_Y;
  const boxLeftPx = PRINT_ORIGIN_PX.x + displayBoxState.fromCenterCm * PX_PER_CM_X - boxWidthPx / 2;
  const boxTopPx = PRINT_ORIGIN_PX.y + displayBoxState.fromNeckCm * PX_PER_CM_Y;
  const materialWidthPx = renderBoxState.widthCm * PX_PER_CM_X;
  const materialHeightPx = renderBoxState.heightCm * PX_PER_CM_Y;
  const materialLeftPx = PRINT_ORIGIN_PX.x + renderBoxState.fromCenterCm * PX_PER_CM_X - materialWidthPx / 2;
  const materialTopPx = PRINT_ORIGIN_PX.y + renderBoxState.fromNeckCm * PX_PER_CM_Y;
  const printTechnique: CustomerArtworkTechnique | undefined =
    isCustomerArtworkTechnique(activeArtwork?.technique)
      ? activeArtwork.technique
      : undefined;
  const sourceArtworkUrl = activeArtwork?.previewUrl ?? activeArtwork?.fileUrl;
  const simulatorArtworkUrl = sourceArtworkUrl
    ? uploadReadableAssetUrl(sourceArtworkUrl)
    : undefined;
  const canRenderPrintMaterial = Boolean(
    simulatorArtworkUrl &&
      isRenderableImage(simulatorArtworkUrl, activeArtwork?.fileType, activeArtwork?.previewKind) &&
      printTechnique &&
      garmentFolder,
  );
  // Keep the costly fabric/lighting sample anchored to the committed box while
  // a gesture is active. The outer artwork layer supplies the live movement or
  // scale, then one accurate material render runs after pointer-up.
  const materialBox = useMemo(
    () => ({
      left: Math.max(0, Math.round(materialLeftPx)),
      top: Math.max(0, Math.round(materialTopPx)),
      width: Math.max(1, Math.round(materialWidthPx)),
      height: Math.max(1, Math.round(materialHeightPx)),
    }),
    [materialHeightPx, materialLeftPx, materialTopPx, materialWidthPx],
  );

  useEffect(() => {
    if (!interactive || !activeArtwork || !printAreaDims) return;
    if (
      renderBoxState.widthCm !== boxState.widthCm ||
      renderBoxState.heightCm !== boxState.heightCm ||
      renderBoxState.fromNeckCm !== boxState.fromNeckCm ||
      renderBoxState.fromCenterCm !== boxState.fromCenterCm
    ) {
      updatePosition(view, renderBoxState);
    }
  }, [activeArtwork, boxState, interactive, printAreaDims, renderBoxState, updatePosition, view]);

  const canEditArtwork = Boolean(
    interactive &&
      showProductionGuides &&
      showBox &&
      activeArtwork?.technique &&
      printAreaDims
  );
  const showMaxArea =
    showProductionGuides &&
    interactive &&
    showBox &&
    !!activeArtwork?.guidelines.maximumArea &&
    !!printAreaDims;
  const showLeftChest =
    showProductionGuides &&
    interactive &&
    view === "front" &&
    !isToteProduct &&
    showBox &&
    !!activeArtwork?.guidelines.leftChest;

  const maxAreaWidthPx = printAreaDims ? printAreaDims.rightPx - printAreaDims.leftPx : 0;
  const maxAreaHeightPx = printAreaDims ? printAreaDims.bottomPx - printAreaDims.topPx : 0;
  const maxAreaLeftPx = printAreaDims?.leftPx ?? 0;
  const maxAreaTopPx = printAreaDims?.topPx ?? 0;

  const chestWidthPx = LEFT_CHEST_DIMENSIONS.width * PX_PER_CM_X;
  const chestHeightPx = LEFT_CHEST_DIMENSIONS.height * PX_PER_CM_Y;
  const chestLeftPx =
    PRINT_ORIGIN_PX.x +
    LEFT_CHEST_PLACEMENT.fromCenterCm * PX_PER_CM_X -
    chestWidthPx / 2;
  const chestTopPx =
    PRINT_ORIGIN_PX.y +
    LEFT_CHEST_PLACEMENT.fromNeckCm * PX_PER_CM_Y;

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
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
      ...renderBoxState,
      widthCm: origin.startWidthCm,
      heightCm: origin.startHeightCm,
      fromNeckCm: origin.startFromNeckCm,
      fromCenterCm: origin.startFromCenterCm,
      alignH: null,
      alignV: null,
    };

    const nextPosition = origin.mode === "move"
      ? constrainArtworkToPrintArea(
          {
            ...originState,
            fromCenterCm:
              origin.startFromCenterCm + dCanvasPxX / PX_PER_CM_X,
            fromNeckCm:
              origin.startFromNeckCm + dCanvasPxY / PX_PER_CM_Y,
          },
          printAreaDims
        )
      : constrainArtworkToPrintArea(
          {
            ...originState,
            ...resizeWithAspect(
              originState,
              "height",
              origin.startHeightCm + dCanvasPxY / PX_PER_CM_Y
            ),
          },
          printAreaDims
        );

    dragPositionRef.current = nextPosition;
    if (dragFrameRef.current === null) {
      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = null;
        setDragPosition(dragPositionRef.current);
      });
    }
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
              ...renderBoxState,
              ...resizeWithAspect(
                renderBoxState,
                "width",
                renderBoxState.widthCm + delta
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
            ...renderBoxState,
            alignH: null,
            alignV: null,
            fromCenterCm:
              event.key === "ArrowLeft"
                ? renderBoxState.fromCenterCm - step
                : event.key === "ArrowRight"
                  ? renderBoxState.fromCenterCm + step
                  : renderBoxState.fromCenterCm,
            fromNeckCm:
              event.key === "ArrowUp"
                ? renderBoxState.fromNeckCm - step
                : event.key === "ArrowDown"
                  ? renderBoxState.fromNeckCm + step
                  : renderBoxState.fromNeckCm,
          },
          printAreaDims
        )
      );
    }
  };

  const handlePointerUp = () => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    const finalPosition = dragPositionRef.current;
    dragOrigin.current = null;
    dragPositionRef.current = null;
    if (finalPosition) updatePosition(view, finalPosition);
    setDragPosition(null);
    setDragMode(null);
  };

  const handleDragStart = (e: ReactPointerEvent<HTMLDivElement>, mode: DragMode) => {
    if (!canEditArtwork) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragMode(mode);
    setDragPosition(renderBoxState);
    dragPositionRef.current = renderBoxState;
    dragOrigin.current = {
      mode,
      pointerX: e.clientX,
      pointerY: e.clientY,
      startWidthCm: renderBoxState.widthCm,
      startHeightCm: renderBoxState.heightCm,
      startFromNeckCm: renderBoxState.fromNeckCm,
      startFromCenterCm: renderBoxState.fromCenterCm,
    };
  };

  return (
    <div
      ref={canvasRef}
      className={`relative ${
        interactive && (view === "front" || view === "back")
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
          inset: `${garmentInsetPercent}%`,
        }}
      >
        {/* Immediate colour fallback while the detail-rich canvas composite loads. */}
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: getDisplayPreviewHex(colourHex),
            WebkitMaskImage: `url(${garmentAssetPath(productId, view, "mask")})`,
            maskImage: `url(${garmentAssetPath(productId, view, "mask")})`,
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        />
        <GarmentComposite
          maskSrc={garmentAssetPath(productId, view, "mask")}
          textureSrc={garmentAssetPath(productId, view, "texture")}
          shadowSrc={garmentAssetPath(productId, view, "shadow")}
          highlightSrc={garmentAssetPath(productId, view, "highlight")}
          colourHex={colourHex}
          renderProfile={garmentRenderConfig.profile}
          cacheScope={garmentFolder ?? productId}
          exclusiveCacheScope={exclusiveLayerCache}
          onRenderProgress={handleGarmentRenderProgress}
        />
      </div>

      {activeArtwork && (
        <div
          onPointerDown={(e) => handleDragStart(e, "move")}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
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
          {canRenderPrintMaterial && printTechnique && garmentFolder && simulatorArtworkUrl ? (
            <ArtworkMaterialCanvas
              artworkSrc={simulatorArtworkUrl}
              fallbackArtworkSrc={sourceArtworkUrl}
              technique={printTechnique}
              garmentFolder={garmentFolder}
              artworkWidthCm={renderBoxState.widthCm}
              box={materialBox}
              garmentInsetPercent={garmentInsetPercent}
              textureSrc={garmentAssetPath(productId, view, "texture")}
              shadowSrc={garmentAssetPath(productId, view, "shadow")}
              highlightSrc={garmentAssetPath(productId, view, "highlight")}
              reflectiveColour={activeArtwork.reflectiveColour}
            />
          ) : (
            <ArtworkTechniquePrompt />
          )}
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
              className="absolute -bottom-5 left-1/2 z-20 h-3 w-3 -translate-x-1/2 cursor-ns-resize rounded-sm bg-[#B534CC] ring-1 ring-white/90"
            />
          )}
          {dragMode && (
            // Keep this literal black: it is a translucent contrast overlay over arbitrary garment colours.
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute left-1/2 top-[calc(100%+30px)] z-30 min-w-max -translate-x-1/2 rounded-sm border border-white/65 bg-[#111111]/78 px-3 py-2 font-sans text-xs font-semibold leading-4 text-white  "
            >
              {dragMode === "move" ? (
                <>
                  <span className="block">
                    Centre: {formatPlacementCm(displayBoxState.fromCenterCm, true)} cm
                  </span>
                  <span className="block">
                    From neck: {formatPlacementCm(displayBoxState.fromNeckCm)} cm
                  </span>
                </>
              ) : (
                <>
                  <span className="block">
                    Width: {formatPlacementCm(displayBoxState.widthCm)} cm
                  </span>
                  <span className="block">
                    Height: {formatPlacementCm(displayBoxState.heightCm)} cm
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {showNeckLabel && neckLabel && neckLabelBoxStyle && (
        <div className="absolute z-10" style={neckLabelBoxStyle}>
          <NeckLabelPreview
            neckLabel={neckLabel}
            previewUrl={neckLabelPreviewUrl}
          />
        </div>
      )}

      {showMaxArea && (
        <div
          role="presentation"
          aria-label="Maximum print area guideline"
          className="pointer-events-none absolute z-[15] border border-dashed border-[#B534CC]/70"
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
            className="pointer-events-none absolute bottom-[12%] left-1/2 top-[20%] z-[14] border-l-[0.5px] border-dashed border-[#B534CC]/28"
          />
      )}

      {showLeftChest && (
        <div
          role="presentation"
          aria-label="Left chest print guideline"
          className="pointer-events-none absolute z-[15] border border-dashed border-[#B534CC]/70"
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
