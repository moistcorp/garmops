import type { ProductId } from "@/lib/configurator/pricing";
import type { GarmentView } from "@/lib/configurator/types/garment";

export function getGarmentFolder(productId: ProductId): string | null {
  if (productId.includes("canvas-tote")) return "canvas-tote-bag";
  if (productId.includes("boxy-fit-hoodie")) return "boxy-fit-hoodie";
  if (productId.includes("regular-fit-hoodie")) return "regular-fit-hoodie";
  if (productId.includes("regular-fit-sweatshirt")) return "regular-fit-sweatshirt";
  if (productId.includes("longsleeve")) return "longsleeve-tee";
  if (productId.includes("polo")) return "polo";
  if (productId.includes("boxy-fit-tee")) return "boxy-fit-tee";
  if (productId.includes("regular-fit-tee")) return "regular-fit-tee";
  return null;
}

export function garmentAssetPath(productId: ProductId, view: GarmentView, layer: string): string {
  const garmentFolder = getGarmentFolder(productId);
  if (!garmentFolder) return "";
  const assetFolder = view === "neck" && garmentFolder === "regular-fit-hoodie" ? "boxy-fit-hoodie" : garmentFolder;
  const regularTeePngDetail = garmentFolder === "regular-fit-tee" && (view === "front" || view === "back") && layer !== "mask";
  const extension = layer === "mask" || regularTeePngDetail ? "png" : "webp";
  return `/garments/${assetFolder}/${view}/${layer}.${extension}`;
}
