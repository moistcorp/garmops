"use client";

import { useMemo, useState } from "react";
import { Eye, Grid3X3, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { GarmentView } from "@/lib/configurator/types/garment";
import type { ProductId } from "@/lib/configurator/pricing";
import type { Artwork, ArtworkSide, NeckLabel } from "@/lib/configurator/types/configurator";
import CanvasRenderer from "./CanvasRenderer";
import ViewTabs from "./ViewTabs";

interface GarmentPreviewProps {
  activeView: GarmentView;
  onViewChange: (view: GarmentView) => void;
  colourHex: string;
  colourName?: string;
  productId: ProductId;
  artwork: Artwork;
  neckLabel?: NeckLabel;
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
    warning: dpi && dpi < 150 ? `Artwork may print soft at approximately ${dpi} DPI.` : undefined,
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
  colourName,
  productId,
  artwork,
  neckLabel,
}: GarmentPreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [contrastBackground, setContrastBackground] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const activeArtwork = activeView === "front" ? artwork.front : activeView === "back" ? artwork.back : undefined;
  const quality = getArtworkQuality(activeArtwork);
  const contrastWarning = useMemo(() => {
    if (!activeArtwork || activeArtwork.averageLuminance === undefined) return undefined;
    const difference = Math.abs(luminance(colourHex) - activeArtwork.averageLuminance);
    return difference < 0.18 ? "Artwork contrast is low against this garment colour. Review it on a larger screen or use a lighter/darker artwork colour." : undefined;
  }, [activeArtwork, colourHex]);

  return (
    <div className="flex h-full w-full min-h-0 flex-col p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E5E5E5] bg-white/90 px-3 py-2 shadow-sm">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#111111]">{colourName ?? "Selected colour"} <span className="font-normal text-[#111111]/50">{colourHex.toUpperCase()}</span></p>
          {activeArtwork ? (
            <p className="mt-0.5 truncate text-[11px] text-[#111111]/55">
              {activeArtwork.width} × {activeArtwork.height} cm · {activeArtwork.fromNeck} cm below neckline · {activeArtwork.fromCenter === 0 ? "centred" : `${Math.abs(activeArtwork.fromCenter)} cm ${activeArtwork.fromCenter > 0 ? "right" : "left"}`}
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-[#111111]/55">Select front or back artwork to view production dimensions.</p>
          )}
        </div>
        <div className="flex items-center gap-1" aria-label="Preview controls">
          <button type="button" onClick={() => setShowGuides((value) => !value)} aria-pressed={showGuides} className={`flex h-9 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold ${showGuides ? "border-[var(--color-teal)] text-[var(--color-teal-dark)]" : "border-[#E5E5E5] text-[#111111]/55"}`}><Grid3X3 size={14} /> Guides</button>
          <button type="button" onClick={() => setContrastBackground((value) => !value)} aria-pressed={contrastBackground} aria-label="Toggle high-contrast preview background" className={`flex h-9 w-9 items-center justify-center rounded-full border ${contrastBackground ? "border-[var(--color-teal)] text-[var(--color-teal-dark)]" : "border-[#E5E5E5] text-[#111111]/55"}`}><Eye size={15} /></button>
          <button type="button" onClick={() => setZoom((value) => Math.max(0.75, +(value - 0.1).toFixed(2)))} disabled={zoom <= 0.75} aria-label="Zoom out" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E5] disabled:opacity-35"><ZoomOut size={15} /></button>
          <span className="w-11 text-center text-[11px] font-semibold text-[#111111]/60" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(1.5, +(value + 0.1).toFixed(2)))} disabled={zoom >= 1.5} aria-label="Zoom in" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E5] disabled:opacity-35"><ZoomIn size={15} /></button>
          <button type="button" onClick={() => setZoom(1)} aria-label="Reset zoom" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E5E5]"><RotateCcw size={14} /></button>
        </div>
      </div>

      <div className={`relative mt-3 min-h-0 flex-1 overflow-hidden rounded-xl ${contrastBackground ? "bg-[linear-gradient(45deg,#d8d8d8_25%,transparent_25%),linear-gradient(-45deg,#d8d8d8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#d8d8d8_75%),linear-gradient(-45deg,transparent_75%,#d8d8d8_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0]" : "bg-[#F5F5F5]"}`}>
        <div className="flex h-full w-full items-center justify-center transition-transform duration-200" style={{ transform: `scale(${zoom})` }}>
          <CanvasRenderer
            view={activeView}
            colourHex={colourHex}
            productId={productId}
            artwork={artwork}
            neckLabel={neckLabel}
            showProductionGuides={showGuides}
            className="aspect-square h-[min(68dvh,760px)] max-h-full max-w-full rounded-lg"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-col items-center gap-2">
        {(quality.warning || contrastWarning) && (
          <div role="status" className="w-full rounded-xl border border-[#E7C56A] bg-[#FFF8E7] px-3 py-2 text-xs leading-relaxed text-[#6E4D08]">
            {quality.warning ?? contrastWarning}
          </div>
        )}
        {quality.metadata && <p className="text-[11px] text-[#111111]/50">File check: {quality.metadata}</p>}
        <ViewTabs activeView={activeView} onChange={onViewChange} productId={productId} />
        <p className="text-center text-[10px] leading-relaxed text-[#111111]/45">Digital preview is indicative. Final artwork size, colour and placement are confirmed during production review.</p>
      </div>
    </div>
  );
}
