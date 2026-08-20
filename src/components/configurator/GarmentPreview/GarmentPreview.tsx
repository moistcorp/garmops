"use client";

import type { GarmentView } from "@/lib/configurator/types/garment";
import type { ProductId } from "@/lib/configurator/pricing";
import type { Artwork, NeckLabel } from "@/lib/configurator/types/configurator";
import { isCustomerArtworkTechnique } from "@/lib/configurator/types/configurator";
import { getArtworkQuality } from "@/lib/configurator/artworkQuality";
import { getArtworkContrast } from "@/lib/configurator/artworkQuality";
import { isCustomNeckLabel } from "@/lib/configurator/neckLabel";
import { NECK_LABEL_POSITION_LABELS } from "@/lib/configurator/neckLabel";
import { AlertTriangle, LoaderCircle } from "lucide-react";
import CanvasRenderer from "./CanvasRenderer";
import type { GarmentRenderResult } from "./CanvasRenderer";
import ViewTabs from "./ViewTabs";

interface GarmentPreviewProps {
  activeView: GarmentView;
  onViewChange: (view: GarmentView) => void;
  colourHex: string;
  productId: ProductId;
  artwork: Artwork;
  neckLabel?: NeckLabel;
  neckLabelPreviewUrl?: string;
  hideBackView?: boolean;
  showProductionGuides?: boolean;
  exclusiveLayerCache?: boolean;
  onGarmentRenderProgress?: (result: GarmentRenderResult) => void;
  previewPending?: boolean;
}

export const NECK_PREVIEW_CANVAS_CLASS =
  "aspect-[7817/5542] w-[90%] max-w-none shrink-0 translate-y-[2%] rounded-sm sm:w-[94%] lg:w-[98%]";

export default function GarmentPreview({
  activeView,
  onViewChange,
  colourHex,
  productId,
  artwork,
  neckLabel,
  neckLabelPreviewUrl,
  hideBackView = false,
  showProductionGuides = false,
  exclusiveLayerCache = false,
  onGarmentRenderProgress,
  previewPending = false,
}: GarmentPreviewProps) {
  const activeArtwork = activeView === "front" ? artwork.front : activeView === "back" ? artwork.back : undefined;
  const quality = getArtworkQuality(activeArtwork);
  const contrast = getArtworkContrast(activeArtwork, colourHex);

  return (
    <div className="relative h-full w-full min-h-0">
      <div className="absolute inset-3 bg-(--color-studio-bg) sm:inset-4">
        <div className="flex h-full w-full items-center justify-center">
          <CanvasRenderer
            view={activeView}
            colourHex={colourHex}
            productId={productId}
            artwork={artwork}
            neckLabel={neckLabel}
            neckLabelPreviewUrl={neckLabelPreviewUrl}
            showProductionGuides={showProductionGuides}
            exclusiveLayerCache={exclusiveLayerCache}
            onGarmentRenderProgress={onGarmentRenderProgress}
            className={
              activeView === "neck"
                ? NECK_PREVIEW_CANVAS_CLASS
                : "aspect-square h-[min(68dvh,760px)] max-h-full max-w-full scale-110 rounded-sm"
            }
          />
        </div>
      </div>

      {previewPending ? (
        <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center bg-(--color-studio-bg)/70 backdrop-blur-[2px] sm:inset-4" role="status" aria-live="polite">
          <span className="flex items-center gap-2 rounded-sm border border-(--color-rule) bg-white/90 px-3 py-2 text-xs font-medium text-(--text-primary)/70"><LoaderCircle size={15} className="animate-spin text-(--color-accent)" aria-hidden="true" /> Updating garment preview…</span>
        </div>
      ) : null}

      {showProductionGuides && activeArtwork && isCustomerArtworkTechnique(activeArtwork.technique) ? <div className="pointer-events-none absolute left-6 top-6 z-20 rounded-sm border border-violet-700/20 bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-violet-950">Purple outline · safe print area</div> : null}

      {activeView === "neck" && neckLabel ? (
        <div className="pointer-events-none absolute left-6 top-6 z-20 max-w-[220px] rounded-sm border border-(--color-rule) bg-white/92 px-3 py-2 text-xs text-(--text-primary)/65 shadow-sm">
          <p className="font-semibold text-(--text-primary)">{isCustomNeckLabel(neckLabel) ? "Custom neck label" : "Standard size label · Included"}</p>
          <p className="mt-1">{neckLabel.dimensions.replace("x", " × ")} mm · {NECK_LABEL_POSITION_LABELS[neckLabel.position]}</p>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-4 bottom-2 z-20 flex flex-col items-start gap-2">
        {contrast?.lowContrast ? <p className="flex max-w-md items-start gap-1.5 rounded-sm border border-amber-700/25 bg-amber-50/95 px-2.5 py-2 text-xs leading-relaxed text-amber-950"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> Low artwork contrast on this garment colour.</p> : null}
        {quality?.effectivePpi && <p className="text-xs leading-relaxed text-(--text-primary)/50">Artwork quality is assessed at its current physical size.</p>}
        <div className="pointer-events-auto">
          <ViewTabs
            activeView={activeView}
            onChange={onViewChange}
            productId={productId}
            hideBackView={hideBackView}
          />
        </div>
      </div>
    </div>
  );
}
