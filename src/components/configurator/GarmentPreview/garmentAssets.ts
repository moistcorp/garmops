import type { ProductId } from "@/lib/configurator/pricing";
import type { GarmentView } from "@/lib/configurator/types/garment";

export type GarmentRenderProfile = "standard" | "photographic";

export type GarmentFolder =
  | "regular-fit-tee"
  | "boxy-fit-tee"
  | "longsleeve-tee"
  | "polo"
  | "regular-fit-sweatshirt"
  | "regular-fit-hoodie"
  | "boxy-fit-hoodie"
  | "canvas-tote-bag";

export interface GarmentViewRenderConfig {
  profile: GarmentRenderProfile;
  insetPercent: number;
  /** Another product's authentic asset set used while this view is unavailable. */
  assetFolder?: GarmentFolder;
}

type GarmentRenderConfig = Record<GarmentView, GarmentViewRenderConfig>;

const photographic = (
  insetPercent: number,
  assetFolder?: GarmentFolder,
): GarmentViewRenderConfig => ({
  profile: "photographic",
  insetPercent,
  ...(assetFolder ? { assetFolder } : {}),
});

/**
 * Rendering and framing are asset properties, so keep them beside the asset
 * mapping instead of inferring quality from a filename in the compositor.
 *
 * Regular Fit Tee values intentionally match its original implementation.
 * The 1670px sets use the same compositor after visual/source inspection, but
 * keep their own framing so wide sleeves, hoods and tote handles are complete.
 */
const GARMENT_RENDER_CONFIG: Record<GarmentFolder, GarmentRenderConfig> = {
  "regular-fit-tee": {
    front: photographic(1),
    back: photographic(1),
    neck: photographic(2),
  },
  "boxy-fit-tee": {
    front: photographic(1),
    back: photographic(1),
    neck: photographic(2),
  },
  "longsleeve-tee": {
    front: photographic(1),
    back: photographic(1),
    neck: photographic(2),
  },
  polo: {
    front: photographic(1),
    back: photographic(1),
    neck: photographic(2),
  },
  "regular-fit-sweatshirt": {
    front: photographic(1),
    back: photographic(1),
    neck: photographic(2),
  },
  "regular-fit-hoodie": {
    front: photographic(-3.5),
    back: photographic(1),
    // No authentic Regular Fit Hoodie neck set exists yet. Keep the existing
    // Boxy Fit Hoodie fallback explicit so the missing source cannot be hidden.
    neck: photographic(2, "boxy-fit-hoodie"),
  },
  "boxy-fit-hoodie": {
    front: photographic(-3.5),
    back: photographic(1),
    neck: photographic(2),
  },
  "canvas-tote-bag": {
    front: photographic(-5),
    back: photographic(-5),
    neck: photographic(2),
  },
};

const FALLBACK_RENDER_CONFIG: GarmentViewRenderConfig = {
  profile: "standard",
  insetPercent: 2,
};

export function getGarmentFolder(productId: ProductId): GarmentFolder | null {
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

export function getGarmentRenderConfig(
  productId: ProductId,
  view: GarmentView,
): GarmentViewRenderConfig {
  const garmentFolder = getGarmentFolder(productId);
  if (!garmentFolder) return FALLBACK_RENDER_CONFIG;
  return GARMENT_RENDER_CONFIG[garmentFolder][view];
}

export function garmentAssetPath(productId: ProductId, view: GarmentView, layer: string): string {
  const garmentFolder = getGarmentFolder(productId);
  if (!garmentFolder) return "";
  const assetFolder = getGarmentRenderConfig(productId, view).assetFolder ?? garmentFolder;
  const regularTeePngDetail = garmentFolder === "regular-fit-tee" && (view === "front" || view === "back") && layer !== "mask";
  const extension = layer === "mask" || regularTeePngDetail ? "png" : "webp";
  return `/garments/${assetFolder}/${view}/${layer}.${extension}`;
}
