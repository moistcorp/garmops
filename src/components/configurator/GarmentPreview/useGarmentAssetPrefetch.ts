"use client";

import { useEffect } from "react";
import type { ProductId } from "@/lib/configurator/pricing";
import type { GarmentView } from "@/lib/configurator/types/garment";
import { garmentAssetPath, getGarmentFolder } from "./garmentAssets";

const GARMENT_VIEWS: readonly GarmentView[] = ["front", "back", "neck"];
const GARMENT_LAYERS = ["mask", "texture", "shadow", "highlight"] as const;

export function getInactiveGarmentViews(view: GarmentView): GarmentView[] {
  return GARMENT_VIEWS.filter((candidate) => candidate !== view);
}

export function useGarmentAssetPrefetch(
  productId: ProductId,
  view: GarmentView,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled || !getGarmentFolder(productId)) return;
    const images: HTMLImageElement[] = [];
    const prefetch = () => {
      for (const inactiveView of getInactiveGarmentViews(view)) {
        for (const layer of GARMENT_LAYERS) {
          const image = new Image();
          image.crossOrigin = "anonymous";
          image.decoding = "async";
          image.fetchPriority = "low";
          image.src = garmentAssetPath(productId, inactiveView, layer);
          images.push(image);
        }
      }
    };
    const idle = typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(prefetch, { timeout: 2_000 })
      : globalThis.setTimeout(prefetch, 800) as unknown as number;
    return () => {
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      else globalThis.clearTimeout(idle);
      for (const image of images) image.src = "";
    };
  }, [enabled, productId, view]);
}
