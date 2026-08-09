"use client";

import { useEffect } from "react";
import type { ProductId } from "@/lib/configurator/pricing";
import type { GarmentView } from "@/lib/configurator/types/garment";
import { garmentAssetPath, getGarmentFolder } from "./garmentAssets";

export function useGarmentAssetPrefetch(productId: ProductId, view: GarmentView) {
  useEffect(() => {
    if (!getGarmentFolder(productId)) return;
    const nextView: GarmentView = view === "front" ? "back" : view === "back" ? "neck" : "front";
    const images: HTMLImageElement[] = [];
    const prefetch = () => {
      for (const layer of ["mask", "texture", "shadow", "highlight"]) {
        const image = new Image();
        image.decoding = "async";
        image.src = garmentAssetPath(productId, nextView, layer);
        images.push(image);
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
  }, [productId, view]);
}
