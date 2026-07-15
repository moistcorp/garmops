"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
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

interface CanvasRendererProps {
  view: GarmentView;
  colourHex: string;
}

// PLACEHOLDER ASSET — no real flat-lay image exists yet.
// Swap this path when the grayscale/luminosity base photo is added to /public.
const BASE_IMAGE_SRC = "/configurator/garments/tshirt-base-grayscale.png";

// Normalized (0–1) source-image crop regions. Front/Back use the full frame;
// Neck crops into the collar area. Placeholder estimates — re-tune against
// the real asset once it exists.
const CROP_REGIONS: Record<GarmentView, { x: number; y: number; width: number; height: number }> = {
  front: { x: 0, y: 0, width: 1, height: 1 },
  back: { x: 0, y: 0, width: 1, height: 1 },
  neck: { x: 0.32, y: 0.02, width: 0.36, height: 0.22 },
};

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

export default function CanvasRenderer({ view, colourHex }: CanvasRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgStatus, setImgStatus] = useState<"loading" | "loaded" | "error">("loading");
  const { positions, updatePosition } = useArtworkPosition();
  const dragOrigin = useRef<DragOrigin | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgStatus("loaded");
    };
    img.onerror = () => setImgStatus("error");
    img.src = BASE_IMAGE_SRC;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE.width, CANVAS_SIZE.height);

    if (imgStatus !== "loaded" || !imgRef.current) {
      // Fallback until the real asset exists: flat colour swatch + status
      // text, so the pipeline is visibly wired end-to-end.
      ctx.fillStyle = "#E5E5E5";
      ctx.fillRect(0, 0, CANVAS_SIZE.width, CANVAS_SIZE.height);
      ctx.fillStyle = colourHex;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(150, 150, 300, 300);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#111111";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        imgStatus === "error" ? "Base image not found (placeholder)" : "Loading…",
        CANVAS_SIZE.width / 2,
        CANVAS_SIZE.height - 20
      );
      return;
    }

    const img = imgRef.current;
    const crop = CROP_REGIONS[view];
    const sx = crop.x * img.naturalWidth;
    const sy = crop.y * img.naturalHeight;
    const sWidth = crop.width * img.naturalWidth;
    const sHeight = crop.height * img.naturalHeight;

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = colourHex;
    ctx.fillRect(0, 0, CANVAS_SIZE.width, CANVAS_SIZE.height);

    // Multiply the grayscale/luminosity base image over the colour fill to
    // recover shading — same blend approach across all three views.
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, CANVAS_SIZE.width, CANVAS_SIZE.height);

    ctx.globalCompositeOperation = "source-over";
  }, [view, colourHex, imgStatus]);

  const showBox = DRAGGABLE_VIEWS.includes(view);
  const boxState = positions[view];

  const boxWidthPx = boxState.widthCm * PX_PER_CM_X;
  const boxHeightPx = boxState.heightCm * PX_PER_CM_Y;
  const boxLeftPx = CANVAS_SIZE.width / 2 + boxState.fromCenterCm * PX_PER_CM_X - boxWidthPx / 2;
  const boxTopPx = boxState.fromNeckCm * PX_PER_CM_Y;

  function handlePointerMove(e: PointerEvent) {
    const origin = dragOrigin.current;
    if (!origin) return;
    const dPxX = e.clientX - origin.pointerX;
    const dPxY = e.clientY - origin.pointerY;

    if (origin.mode === "move") {
      const nextFromCenterCm = clampDim(origin.startFromCenterCm + dPxX / PX_PER_CM_X, MIN_OFFSET);
      const nextFromNeckCm = clampDim(origin.startFromNeckCm + dPxY / PX_PER_CM_Y, MIN_OFFSET);
      updatePosition(view, { fromCenterCm: nextFromCenterCm, fromNeckCm: nextFromNeckCm });
      return;
    }

    // resize (bottom-right handle): drive width from horizontal delta,
    // reuse the same aspect-lock math PositionControls' steppers use.
    const nextWidthCm = origin.startWidthCm + dPxX / PX_PER_CM_X;
    const partial = resizeWithAspect(
      { ...boxState, widthCm: origin.startWidthCm, heightCm: origin.startHeightCm },
      "width",
      nextWidthCm
    );
    updatePosition(view, partial);
  }

  function handlePointerUp() {
    dragOrigin.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }

  function startDrag(mode: DragMode) {
    return (e: ReactPointerEvent<HTMLDivElement>) => {
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
  }

  return (
    <div className="relative aspect-square h-[min(58dvh,540px)] max-h-[540px] max-w-full">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE.width}
        height={CANVAS_SIZE.height}
        className="h-full w-full bg-[#F3F3F2]"
      />
      {showBox && (
        <div
          role="presentation"
          onPointerDown={startDrag("move")}
          className="absolute cursor-move border-2 border-dashed border-neutral-900/70 bg-neutral-900/5"
          style={{
            left: `${(boxLeftPx / CANVAS_SIZE.width) * 100}%`,
            top: `${(boxTopPx / CANVAS_SIZE.height) * 100}%`,
            width: `${(boxWidthPx / CANVAS_SIZE.width) * 100}%`,
            height: `${(boxHeightPx / CANVAS_SIZE.height) * 100}%`,
          }}
        >
          <div
            role="presentation"
            onPointerDown={startDrag("resize")}
            aria-label="Resize artwork"
            className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-neutral-900"
          />
        </div>
      )}
    </div>
  );
}
