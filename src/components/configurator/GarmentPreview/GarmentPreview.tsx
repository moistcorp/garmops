"use client";

import type { GarmentView } from "@/lib/configurator/types/garment";
import type { ProductId } from "@/lib/configurator/pricing";
import type { Artwork, NeckLabel } from "@/lib/configurator/types/configurator";
import { getArtworkQuality } from "@/lib/configurator/artworkQuality";
import CanvasRenderer from "./CanvasRenderer";
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
}

export const NECK_PREVIEW_CANVAS_CLASS =
  "aspect-[7817/5542] w-[104%] max-w-none shrink-0 translate-y-[2%] rounded-[4px] sm:w-[108%] lg:w-[112%]";

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
}: GarmentPreviewProps) {
  const activeArtwork = activeView === "front" ? artwork.front : activeView === "back" ? artwork.back : undefined;
  const quality = getArtworkQuality(activeArtwork);

  return (
    <div className="relative h-full w-full min-h-0">
      <div className="absolute inset-3 bg-[var(--color-studio-bg)] sm:inset-4">
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
            className={
              activeView === "neck"
                ? NECK_PREVIEW_CANVAS_CLASS
                : "aspect-square h-[min(68dvh,760px)] max-h-full max-w-full scale-110 rounded-[4px]"
            }
          />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-4 bottom-2 z-20 flex flex-col items-start gap-2">
        {quality?.effectivePpi && <p className="text-xs leading-relaxed text-[var(--text-primary)]/50">Artwork quality is assessed at its current physical size.</p>}
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
