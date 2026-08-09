import { describe, expect, it } from "vitest";
import { garmentAssetPath, getGarmentFolder } from "./garmentAssets";

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
  });
});
