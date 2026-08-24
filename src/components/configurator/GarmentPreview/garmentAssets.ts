import type { ProductId } from "@/lib/configurator/pricing";
import type { NeckLabelPosition } from "@/lib/configurator/types/configurator";
import type { GarmentView } from "@/lib/configurator/types/garment";
import { garmentAssetUrl } from "@/lib/publicAssets";

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
  /** Product-specific vertical calibration for the neck-label overlay. */
  neckLabelTopPercent?: Partial<Record<NeckLabelPosition, number>>;
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
 * The high-resolution sets use the same compositor after visual/source
 * inspection, but keep their own framing so wide sleeves, hoods and tote
 * handles are complete. Their front/back insets compensate for transparent
 * source-artboard padding and equalize visible garment area with Regular Tee;
 * the values differ by view because the supplied silhouettes occupy different
 * fractions of those artboards.
 */
const GARMENT_RENDER_CONFIG: Record<GarmentFolder, GarmentRenderConfig> = {
  "regular-fit-tee": {
    front: photographic(1),
    back: photographic(1),
    // The Classic T-Shirt neck tape ends at the default overlay origin.
    // Move only its below-tape label down by the simulated 5 mm gap.
    neck: {
      ...photographic(2),
      neckLabelTopPercent: {
        below_neck_tape: 36.5,
      },
    },
  },
  "boxy-fit-tee": {
    front: photographic(-20.5),
    back: photographic(-21.5),
    // The relaxed neck asset has more transparent framing above the collar
    // than the classic tee, so its label needs to sit lower in the canvas.
    neck: {
      ...photographic(2),
      neckLabelTopPercent: {
        below_neck_tape: 39,
        on_neck_tape: 37,
      },
    },
  },
  "longsleeve-tee": {
    front: photographic(-21),
    back: photographic(-22),
    // Match the lower-framed high-resolution neck asset, as with the relaxed
    // tee, so the label clears the collar instead of sitting too high.
    neck: {
      ...photographic(2),
      neckLabelTopPercent: {
        below_neck_tape: 37,
        on_neck_tape: 35,
      },
    },
  },
  polo: {
    front: photographic(-24.5),
    back: photographic(-25.5),
    // The polo collar and back neck seam sit lower in the neck asset than a
    // crew-neck tee, so the label needs a lower overlay position.
    neck: {
      ...photographic(2),
      neckLabelTopPercent: {
        below_neck_tape: 40,
        on_neck_tape: 38,
      },
    },
  },
  "regular-fit-sweatshirt": {
    front: photographic(-21),
    back: photographic(-23.5),
    // The sweatshirt's thicker collar places the back neck seam much higher
    // than the tee assets, so the label needs an earlier overlay position.
    neck: {
      ...photographic(2),
      neckLabelTopPercent: {
        below_neck_tape: 22,
        on_neck_tape: 20,
      },
    },
  },
  "regular-fit-hoodie": {
    front: photographic(-30.5),
    back: photographic(-26),
    // The hood's back neck seam sits higher than the standard tee overlay
    // position, so keep the label just below that seam.
    neck: {
      ...photographic(2),
      neckLabelTopPercent: {
        below_neck_tape: 35,
        on_neck_tape: 33,
      },
    },
  },
  "boxy-fit-hoodie": {
    front: photographic(-30.5),
    back: photographic(-26),
    neck: {
      ...photographic(2),
      neckLabelTopPercent: {
        below_neck_tape: 35,
        on_neck_tape: 33,
      },
    },
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
  return garmentAssetUrl(`${assetFolder}/${view}/${layer}.${extension}`);
}
