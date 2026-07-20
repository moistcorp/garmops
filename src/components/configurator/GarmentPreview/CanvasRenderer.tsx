"use client";

import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ProductId } from "@/lib/configurator/pricing";
import type { Artwork, ArtworkSide, NeckLabel } from "@/lib/configurator/types/configurator";
import type { GarmentView } from "@/lib/configurator/types/garment";
import {
  useArtworkPosition,
  CANVAS_PX,
  PX_PER_CM_X,
  PX_PER_CM_Y,
  DRAGGABLE_VIEWS,
  MIN_OFFSET,
  resizeWithAspect,
  clampDim,
} from "@/lib/configurator/ArtworkPositionContext";
import { PRINT_AREA_SIZE_CHART } from "@/lib/configurator/sizecharts";
import { LEFT_CHEST_DIMENSIONS } from "@/components/configurator/ConfiguratorSidebar/ArtworkPanel/GuidelinesToggles";

// Matches the small top margin PositionControls/the box default use as the
// garment's overall printable boundary — the guideline overlays anchor here
// rather than to the user's current (adjustable) artwork box position, since
// they represent a fixed manufacturing limit, not the artwork placement.
const GUIDELINE_TOP_MARGIN_CM = 3;
const LEFT_CHEST_FROM_CENTER_CM = 9;

interface CanvasRendererProps {
  view: GarmentView;
  colourHex: string;
  productId: ProductId;
  artwork: Artwork;
  neckLabel?: NeckLabel;
}

const CANVAS_SIZE = CANVAS_PX;

type DragMode = "move" | "resize";

interface DragOrigin {
  mode: DragMode;
  pointerX: number;
  pointerY: number;
  startWidthCm: number;
  startHeightCm: number;
  startFromNeckCm: number;
  startFromCenterCm: number;
}

function getGarmentFolder(productId: ProductId): string {
  if (productId.includes("canvas-tote")) return "canvas-tote-bag";
  if (productId.includes("boxy-fit-hoodie")) return "boxy-fit-hoodie";
  if (productId.includes("regular-fit-hoodie")) return "regular-fit-hoodie";
  if (productId.includes("regular-fit-sweatshirt")) return "regular-fit-sweatshirt";
  if (productId.includes("longsleeve")) return "longsleeve-tee";
  if (productId.includes("polo")) return "polo";
  if (productId.includes("boxy-fit-tee")) return "boxy-fit-tee";
  return "regular-fit-tee";
}

function assetPath(productId: ProductId, view: GarmentView, layer: string): string {
  return `/garments/${getGarmentFolder(productId)}/${view}/${layer}.png`;
}

function isRenderableImage(fileUrl?: string): boolean {
  if (!fileUrl) return false;
  return /\.(png|jpe?g|svg|webp)$/i.test(fileUrl) || fileUrl.startsWith("blob:");
}

function ArtworkPreview({ side }: { side: ArtworkSide }) {
  if (isRenderableImage(side.fileUrl)) {
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

function NeckLabelPreview({ neckLabel }: { neckLabel: NeckLabel }) {
  if (isRenderableImage(neckLabel.fileUrl)) {
    return (
      <img
        src={neckLabel.fileUrl}
        alt=""
        draggable={false}
        className="h-full w-full object-contain"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center rounded-sm border border-[#111111]/20 bg-white text-[10px] font-semibold uppercase tracking-wide text-[#111111]/55">
      Label
    </div>
  );
}

export default function CanvasRenderer({
  view,
  colourHex,
  productId,
  artwork,
  neckLabel,
}: CanvasRendererProps) {
  const { positions, updatePosition } = useArtworkPosition();
  const dragOrigin = useRef<DragOrigin | null>(null);

  const showBox = DRAGGABLE_VIEWS.includes(view);
  const boxState = positions[view];
  const activeArtwork = view === "front" ? artwork.front : view === "back" ? artwork.back : undefined;
  const showNeckLabel = view === "neck" && neckLabel?.fileUrl;

  const boxWidthPx = boxState.widthCm * PX_PER_CM_X;
  const boxHeightPx = boxState.heightCm * PX_PER_CM_Y;
  const boxLeftPx = CANVAS_SIZE.width / 2 + boxState.fromCenterCm * PX_PER_CM_X - boxWidthPx / 2;
  const boxTopPx = boxState.fromNeckCm * PX_PER_CM_Y;

  // Print guideline overlays (maximum printable area / left-chest reference),
  // anchored to the garment's fixed boundaries rather than the user's
  // adjustable artwork box — see GUIDELINE_TOP_MARGIN_CM note above.
  const printAreaDims = activeArtwork
    ? PRINT_AREA_SIZE_CHART[activeArtwork.printArea]
    : undefined;
  const showMaxArea = showBox && !!activeArtwork?.guidelines.maximumArea && !!printAreaDims;
  const showLeftChest = showBox && !!activeArtwork?.guidelines.leftChest;

  const maxAreaWidthPx = printAreaDims ? printAreaDims.width * PX_PER_CM_X : 0;
  const maxAreaHeightPx = printAreaDims ? printAreaDims.height * PX_PER_CM_Y : 0;
  const maxAreaLeftPx = CANVAS_SIZE.width / 2 - maxAreaWidthPx / 2;
  const maxAreaTopPx = GUIDELINE_TOP_MARGIN_CM * PX_PER_CM_Y;

  const chestWidthPx = LEFT_CHEST_DIMENSIONS.width * PX_PER_CM_X;
  const chestHeightPx = LEFT_CHEST_DIMENSIONS.height * PX_PER_CM_Y;
  const chestLeftPx = CANVAS_SIZE.width / 2 + LEFT_CHEST_FROM_CENTER_CM * PX_PER_CM_X - chestWidthPx / 2;
  const chestTopPx = GUIDELINE_TOP_MARGIN_CM * PX_PER_CM_Y;

  const handlePointerMove = (e: PointerEvent) => {
    const origin = dragOrigin.current;
    if (!origin) return;
    const dPxX = e.clientX - origin.pointerX;
    const dPxY = e.clientY - origin.pointerY;

    if (origin.mode === "move") {
      updatePosition(view, {
        fromCenterCm: clampDim(origin.startFromCenterCm + dPxX / PX_PER_CM_X, MIN_OFFSET),
        fromNeckCm: clampDim(origin.startFromNeckCm + dPxY / PX_PER_CM_Y, MIN_OFFSET),
      });
      return;
    }

    updatePosition(
      view,
      resizeWithAspect(
        { ...boxState, widthCm: origin.startWidthCm, heightCm: origin.startHeightCm },
        "width",
        origin.startWidthCm + dPxX / PX_PER_CM_X
      )
    );
  };

  const handlePointerUp = () => {
    dragOrigin.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  };

  const handleDragStart = (e: ReactPointerEvent<HTMLDivElement>, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
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
    <div className="relative aspect-square h-[min(64dvh,650px)] max-h-[650px] max-w-full overflow-hidden rounded-lg bg-[#F7F7F7]">
      <div className="absolute inset-[5%]">
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: colourHex,
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
        <img
          src={assetPath(productId, view, "texture")}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain mix-blend-multiply opacity-35"
        />
        <img
          src={assetPath(productId, view, "shadow")}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain mix-blend-multiply opacity-75"
        />
        <img
          src={assetPath(productId, view, "highlight")}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain mix-blend-screen opacity-80"
        />
      </div>

      {activeArtwork && (
        <div
          className="absolute z-10"
          style={{
            left: `${(boxLeftPx / CANVAS_SIZE.width) * 100}%`,
            top: `${(boxTopPx / CANVAS_SIZE.height) * 100}%`,
            width: `${(boxWidthPx / CANVAS_SIZE.width) * 100}%`,
            height: `${(boxHeightPx / CANVAS_SIZE.height) * 100}%`,
          }}
        >
          <ArtworkPreview side={activeArtwork} />
        </div>
      )}

      {showNeckLabel && (
        <div className="absolute left-1/2 top-[20%] z-10 h-[9%] w-[24%] -translate-x-1/2">
          <NeckLabelPreview neckLabel={neckLabel} />
        </div>
      )}

      {showMaxArea && (
        <div
          role="presentation"
          aria-label="Maximum print area guideline"
          className="pointer-events-none absolute z-[15] border-2 border-dashed border-blue-500/70"
          style={{
            left: `${(maxAreaLeftPx / CANVAS_SIZE.width) * 100}%`,
            top: `${(maxAreaTopPx / CANVAS_SIZE.height) * 100}%`,
            width: `${(maxAreaWidthPx / CANVAS_SIZE.width) * 100}%`,
            height: `${(maxAreaHeightPx / CANVAS_SIZE.height) * 100}%`,
          }}
        />
      )}

      {showLeftChest && (
        <div
          role="presentation"
          aria-label="Left chest print guideline"
          className="pointer-events-none absolute z-[15] border-2 border-dashed border-amber-500/80"
          style={{
            left: `${(chestLeftPx / CANVAS_SIZE.width) * 100}%`,
            top: `${(chestTopPx / CANVAS_SIZE.height) * 100}%`,
            width: `${(chestWidthPx / CANVAS_SIZE.width) * 100}%`,
            height: `${(chestHeightPx / CANVAS_SIZE.height) * 100}%`,
          }}
        />
      )}

      {showBox && (
        <div
          role="presentation"
          onPointerDown={(e) => handleDragStart(e, "move")}
          className="absolute z-20 cursor-move border border-dashed border-[#111111]/55 bg-white/10"
          style={{
            left: `${(boxLeftPx / CANVAS_SIZE.width) * 100}%`,
            top: `${(boxTopPx / CANVAS_SIZE.height) * 100}%`,
            width: `${(boxWidthPx / CANVAS_SIZE.width) * 100}%`,
            height: `${(boxHeightPx / CANVAS_SIZE.height) * 100}%`,
          }}
        >
          <div
            role="presentation"
            onPointerDown={(e) => handleDragStart(e, "resize")}
            aria-label="Resize artwork"
            className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-[#111111]"
          />
        </div>
      )}
    </div>
  );
}
