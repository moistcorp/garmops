// src/lib/configurator/ArtworkPositionContext.tsx
"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import type { GarmentView } from "@/lib/configurator/types/garment";

// ---------------------------------------------------------------------------
// Shared types (moved from PositionControls.tsx — now consumed by both
// PositionControls.tsx and CanvasRenderer.tsx, so per the isolation rule this
// is the shared home; PositionControls.tsx no longer redefines these).
// ---------------------------------------------------------------------------

export type HorizontalAlign = "left" | "center" | "right";
export type VerticalAlign = "top" | "center" | "bottom";

export interface PositionControlsState {
  alignH: HorizontalAlign | null;
  alignV: VerticalAlign | null;
  widthCm: number;
  heightCm: number;
  aspectLocked: boolean;
  fromNeckCm: number;
  fromCenterCm: number;
}

export const DEFAULT_POSITION_STATE: PositionControlsState = {
  alignH: null,
  alignV: null,
  widthCm: 20,
  heightCm: 20,
  aspectLocked: true,
  fromNeckCm: 5,
  fromCenterCm: 0,
};

export const STEP = 0.5;
export const MIN_DIM = 1;
export const MIN_OFFSET = 0;

export function clampDim(value: number, min: number = MIN_DIM): number {
  return Math.max(min, Math.round(value * 2) / 2);
}

// ---------------------------------------------------------------------------
// cm <-> px mapping
// Front/back print measurement scale. The printable area is a smaller region
// on the rendered garment, not the full square canvas.
// ---------------------------------------------------------------------------

export const PRINT_AREA_CM = { width: 31, height: 43 };
export const CANVAS_PX = { width: 600, height: 600 };
export const PX_PER_CM_X = 9.2;
export const PX_PER_CM_Y = 8.7;
export const PRINT_ORIGIN_PX = { x: CANVAS_PX.width / 2, y: 146 };

// Views that render/support the draggable + resizable artwork box.
export const DRAGGABLE_VIEWS: readonly GarmentView[] = ["front", "back"];

/**
 * Shared aspect-lock resize math (moved from PositionControls' local
 * setWidth/setHeight so CanvasRenderer's drag-resize handle can apply the
 * identical rule instead of re-deriving it).
 */
export function resizeWithAspect(
  state: PositionControlsState,
  dimension: "width" | "height",
  next: number
): Partial<PositionControlsState> {
  const nextClamped = clampDim(next, MIN_DIM);
  if (dimension === "width") {
    if (state.aspectLocked && state.widthCm > 0) {
      const ratio = state.heightCm / state.widthCm;
      return { widthCm: nextClamped, heightCm: clampDim(nextClamped * ratio, MIN_DIM) };
    }
    return { widthCm: nextClamped };
  }
  if (state.aspectLocked && state.heightCm > 0) {
    const ratio = state.widthCm / state.heightCm;
    return { heightCm: nextClamped, widthCm: clampDim(nextClamped * ratio, MIN_DIM) };
  }
  return { heightCm: nextClamped };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface ArtworkPositionContextValue {
  /** Per-view state. Option 2: all three GarmentViews have a slot; "neck" is
   *  tracked but inert (no box rendered/dragged) this phase. */
  positions: Record<GarmentView, PositionControlsState>;
  /** The view currently shown in the canvas — lets PositionControls know
   *  which slot it's editing without prop-threading through the sidebar. */
  activeView: GarmentView;
  updatePosition: (view: GarmentView, partial: Partial<PositionControlsState>) => void;
}

const ArtworkPositionContext = createContext<ArtworkPositionContextValue | null>(null);

export interface ArtworkPositionProviderProps {
  children: ReactNode;
  /** Controlled by ConfigureClient, which already owns this state for the
   *  view tabs — the provider does not duplicate it. */
  activeView: GarmentView;
}

export function ArtworkPositionProvider({ children, activeView }: ArtworkPositionProviderProps) {
  const [positions, setPositions] = useState<Record<GarmentView, PositionControlsState>>({
    front: { ...DEFAULT_POSITION_STATE },
    back: { ...DEFAULT_POSITION_STATE },
    neck: { ...DEFAULT_POSITION_STATE },
  });

  const updatePosition = useCallback((view: GarmentView, partial: Partial<PositionControlsState>) => {
    setPositions((prev) => {
      return { ...prev, [view]: { ...prev[view], ...partial } };
    });
  }, []);

  return (
    <ArtworkPositionContext.Provider value={{ positions, activeView, updatePosition }}>
      {children}
    </ArtworkPositionContext.Provider>
  );
}

export function useArtworkPosition(): ArtworkPositionContextValue {
  const ctx = useContext(ArtworkPositionContext);
  if (!ctx) {
    throw new Error("useArtworkPosition must be used within an ArtworkPositionProvider");
  }
  return ctx;
}
