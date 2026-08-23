import { describe, expect, it } from "vitest";

import {
  getConfiguratorCtaLabel,
  getPaymentJourneyStep,
} from "./journey";

const defaults = {
  hasArtwork: false,
  hasCustomLabel: false,
  isToteProduct: false,
};

describe("configurator journey labels", () => {
  it("names the next step from the colour step", () => {
    expect(getConfiguratorCtaLabel("garment-colour", defaults)).toBe(
      "Continue to artwork →",
    );
  });

  it("names the next step for the standard label choice", () => {
    expect(getConfiguratorCtaLabel("artwork", defaults)).toBe("Continue without artwork →");
    expect(getConfiguratorCtaLabel("neck-label", defaults)).toBe("Continue to sizes");
  });

  it("uses continuation labels after optional work is added", () => {
    expect(
      getConfiguratorCtaLabel("artwork", {
        ...defaults,
        hasArtwork: true,
      }),
    ).toBe("Continue to neck label →");
    expect(
      getConfiguratorCtaLabel("neck-label", {
        ...defaults,
        hasCustomLabel: true,
      }),
    ).toBe("Continue to sizes");
  });

  it("uses the tote-specific label step and requires its custom upload", () => {
    expect(
      getConfiguratorCtaLabel("artwork", {
        ...defaults,
        hasArtwork: true,
        isToteProduct: true,
      }),
    ).toBe("Continue to bag label →");
    expect(
      getConfiguratorCtaLabel("neck-label", {
        ...defaults,
        isToteProduct: true,
      }),
    ).toBe("Upload bag label to continue");
  });

  it("activates Payment while payment is being prepared", () => {
    expect(getPaymentJourneyStep(false)).toBe("review");
    expect(getPaymentJourneyStep(true)).toBe("payment");
  });
});
