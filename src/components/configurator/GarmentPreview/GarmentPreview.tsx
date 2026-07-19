"use client";

import type { GarmentView } from "@/lib/configurator/types/garment";
import type { ProductId } from "@/lib/configurator/pricing";
import type { Artwork, NeckLabel } from "@/lib/configurator/types/configurator";
import CanvasRenderer from "./CanvasRenderer";
import ViewTabs from "./ViewTabs";

interface GarmentPreviewProps {
  activeView: GarmentView;
  onViewChange: (view: GarmentView) => void;
  colourHex: string;
  productId: ProductId;
  artwork: Artwork;
  neckLabel?: NeckLabel;
}

export default function GarmentPreview({
  activeView,
  onViewChange,
  colourHex,
  productId,
  artwork,
  neckLabel,
}: GarmentPreviewProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-4">
      <CanvasRenderer
        view={activeView}
        colourHex={colourHex}
        productId={productId}
        artwork={artwork}
        neckLabel={neckLabel}
      />
      <ViewTabs activeView={activeView} onChange={onViewChange} productId={productId} />
    </div>
  );
}
