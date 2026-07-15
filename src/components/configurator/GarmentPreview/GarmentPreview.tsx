"use client";

import type { GarmentView } from "@/lib/configurator/types/garment";
import CanvasRenderer from "./CanvasRenderer";
import ViewTabs from "./ViewTabs";

interface GarmentPreviewProps {
  activeView: GarmentView;
  onViewChange: (view: GarmentView) => void;
  colourHex: string;
}

export default function GarmentPreview({
  activeView,
  onViewChange,
  colourHex,
}: GarmentPreviewProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 pb-1">
      <CanvasRenderer view={activeView} colourHex={colourHex} />
      <ViewTabs activeView={activeView} onChange={onViewChange} />
    </div>
  );
}
