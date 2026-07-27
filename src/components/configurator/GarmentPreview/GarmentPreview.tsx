"use client";

import { useMemo } from "react";
import type { GarmentView } from "@/lib/configurator/types/garment";
import type { ProductId } from "@/lib/configurator/pricing";
import type { Artwork, ArtworkSide, NeckLabel } from "@/lib/configurator/types/configurator";
import CanvasRenderer from "./CanvasRenderer";
import ViewTabs from "./ViewTabs";

interface GarmentPreviewProps {
  activeView: GarmentView;
  onViewChange: (view: GarmentView) => void;
  colourHex: string;
  productId: ProductId;
  artwork: Artwork;
  neckLabel?: NeckLabel;
  hideBackView?: boolean;
}

function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return 1;
  const rgb = [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16) / 255);
  return rgb.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function getArtworkQuality(side?: ArtworkSide): { warning?: string; metadata?: string } {
  if (!side) return {};
  const dpi = side.pixelWidth && side.width > 0 ? Math.round(side.pixelWidth / (side.width / 2.54)) : undefined;
  return {
    warning: dpi && dpi < 150
      ? "This image may look blurry once printed. We recommend uploading a higher-resolution file for the sharpest result."
      : undefined,
    metadata: [
      side.pixelWidth && side.pixelHeight ? `${side.pixelWidth} × ${side.pixelHeight}px` : undefined,
      side.hasTransparency === true ? "transparent background" : undefined,
    ].filter(Boolean).join(" · ") || undefined,
  };
}

export default function GarmentPreview({
  activeView,
  onViewChange,
  colourHex,
  productId,
  artwork,
  neckLabel,
  hideBackView = false,
}: GarmentPreviewProps) {
  const activeArtwork = activeView === "front" ? artwork.front : activeView === "back" ? artwork.back : undefined;
  const quality = getArtworkQuality(activeArtwork);
  const contrastWarning = useMemo(() => {
    if (!activeArtwork || activeArtwork.averageLuminance === undefined) return undefined;
    const difference = Math.abs(luminance(colourHex) - activeArtwork.averageLuminance);
    return difference < 0.18 ? "Artwork contrast is low against this garment colour. Review it on a larger screen or use a lighter/darker artwork colour." : undefined;
  }, [activeArtwork, colourHex]);

  return (
    <div className="relative h-full w-full min-h-0">
      <div className="absolute inset-3 overflow-hidden rounded-xl bg-white sm:inset-4">
        <div className="flex h-full w-full items-center justify-center">
          <CanvasRenderer
            view={activeView}
            colourHex={colourHex}
            productId={productId}
            artwork={artwork}
            neckLabel={neckLabel}
            showProductionGuides
            className={
              activeView === "neck"
                ? "aspect-square h-[165%] max-w-none shrink-0 translate-y-[3%] rounded-lg sm:h-[180%] sm:translate-y-[4%] lg:h-[190%] lg:translate-y-[5%]"
                : "aspect-square h-[min(68dvh,760px)] max-h-full max-w-full scale-110 rounded-lg"
            }
          />
        </div>
      </div>

      {(quality.warning || contrastWarning) && (
        <div
          role="status"
          className="absolute inset-x-6 top-16 z-20 rounded-xl border border-[#E7C56A] bg-[#FFF8E7]/90 px-3 py-2 text-xs leading-relaxed text-[#6E4D08] backdrop-blur-md"
        >
          {quality.warning ?? contrastWarning}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-4 bottom-2 z-20 flex flex-col items-center gap-2">
        {quality.metadata && <p className="text-[11px] text-[#111111]/50">File check: {quality.metadata}</p>}
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
