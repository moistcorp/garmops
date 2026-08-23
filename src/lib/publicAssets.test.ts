import { describe, expect, it } from "vitest";
import {
  flatlayAssetPath,
  garmentAssetUrl,
  publicAssetUrl,
} from "./publicAssets";

describe("public asset URLs", () => {
  it("uses the production CDN fallback and normalizes leading slashes", () => {
    expect(publicAssetUrl("/garments/v1/example.png")).toBe(
      "https://assets.garmops.com/garments/v1/example.png",
    );
  });

  it("centralizes immutable garment and flatlay versions", () => {
    expect(garmentAssetUrl("regular-fit-tee/front/mask.png")).toBe(
      "https://assets.garmops.com/garments/v4/regular-fit-tee/front/mask.png",
    );
    expect(flatlayAssetPath("regulartee.png")).toBe(
      "https://assets.garmops.com/flatlays/v4/regulartee.png",
    );
  });
});
