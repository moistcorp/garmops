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
    expect(garmentAssetPath("regular-fit-tee-200gsm", "front", "texture")).toBe("/garments/regular-fit-tee/front/texture.png");
    expect(garmentAssetPath("regular-fit-tee-200gsm", "neck", "texture")).toBe("/garments/regular-fit-tee/neck/texture.webp");
  });

  it("reuses the boxy hoodie neck layers for the regular hoodie", () => {
    expect(garmentAssetPath("regular-fit-hoodie-320gsm", "neck", "mask")).toBe("/garments/boxy-fit-hoodie/neck/mask.png");
    expect(getGarmentRenderConfig("regular-fit-hoodie-320gsm", "neck").assetFolder).toBe("boxy-fit-hoodie");
  });

  it("selects photographic rendering explicitly instead of from asset filenames", () => {
    expect(getGarmentRenderConfig("regular-fit-tee-200gsm", "front").profile).toBe("photographic");
    expect(getGarmentRenderConfig("polo-280gsm", "front").profile).toBe("photographic");
    expect(getGarmentRenderConfig("canvas-tote-bag", "neck").profile).toBe("photographic");
  });

  it("keeps product-specific framing with the reference tee unchanged", () => {
    expect(getGarmentRenderConfig("regular-fit-tee-200gsm", "front").insetPercent).toBe(1);
    expect(getGarmentRenderConfig("regular-fit-hoodie-320gsm", "front").insetPercent).toBe(-3.5);
    expect(getGarmentRenderConfig("canvas-tote-bag", "front").insetPercent).toBe(-5);
  });
});
