import { describe, expect, it } from "vitest";
import {
  garmentAssetPath,
  getGarmentFolder,
  getGarmentRenderConfig,
} from "./garmentAssets";

describe("garment preview asset mapping", () => {
  it("maps product variants to shared renderer folders", () => {
    expect(getGarmentFolder("regular-fit-tee-200gsm")).toBe("regular-fit-tee");
    expect(getGarmentFolder("regular-fit-tee-260gsm")).toBe("regular-fit-tee");
  });

  it("uses byte-correct PNG details for regular tee front and back", () => {
    expect(garmentAssetPath("regular-fit-tee-200gsm", "front", "mask")).toBe("https://assets.garmops.com/garments/v4/regular-fit-tee/front/mask.png");
    expect(garmentAssetPath("regular-fit-tee-200gsm", "front", "texture")).toBe("https://assets.garmops.com/garments/v4/regular-fit-tee/front/texture.png");
    expect(garmentAssetPath("regular-fit-tee-200gsm", "neck", "texture")).toBe("https://assets.garmops.com/garments/v4/regular-fit-tee/neck/texture.webp");
  });

  it("keeps WebP detail layers for other garment families", () => {
    expect(garmentAssetPath("polo-280gsm", "front", "texture")).toBe("https://assets.garmops.com/garments/v4/polo/front/texture.webp");
    expect(garmentAssetPath("canvas-tote-bag", "back", "highlight")).toBe("https://assets.garmops.com/garments/v4/canvas-tote-bag/back/highlight.webp");
  });

  it("uses the regular hoodie asset set for all views", () => {
    expect(garmentAssetPath("regular-fit-hoodie-320gsm", "neck", "mask")).toBe("https://assets.garmops.com/garments/v4/regular-fit-hoodie/neck/mask.png");
    expect(getGarmentRenderConfig("regular-fit-hoodie-320gsm", "neck").assetFolder).toBeUndefined();
  });

  it("returns an empty URL for unmapped products", () => {
    expect(garmentAssetPath("unknown-product" as never, "front", "mask")).toBe("");
  });

  it("selects photographic rendering explicitly instead of from asset filenames", () => {
    expect(getGarmentRenderConfig("regular-fit-tee-200gsm", "front").profile).toBe("photographic");
    expect(getGarmentRenderConfig("polo-280gsm", "front").profile).toBe("photographic");
    expect(getGarmentRenderConfig("canvas-tote-bag", "neck").profile).toBe("photographic");
  });

  it("keeps product-specific framing with the reference tee unchanged", () => {
    expect(getGarmentRenderConfig("regular-fit-tee-200gsm", "front").insetPercent).toBe(1);
    expect(getGarmentRenderConfig("regular-fit-hoodie-320gsm", "front").insetPercent).toBe(-10);
    expect(getGarmentRenderConfig("canvas-tote-bag", "front").insetPercent).toBe(-5);
  });
});
