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
  it("makes optional empty steps explicit", () => {
    expect(getConfiguratorCtaLabel("artwork", defaults)).toBe("Skip artwork");
    expect(getConfiguratorCtaLabel("neck-label", defaults)).toBe(
      "Use standard neck label",
    );
    expect(
      getConfiguratorCtaLabel("neck-label", {
        ...defaults,
        isToteProduct: true,
      }),
    ).toBe("Use standard bag label");
  });

  it("uses continuation labels after optional work is added", () => {
    expect(
      getConfiguratorCtaLabel("artwork", {
        ...defaults,
        hasArtwork: true,
      }),
    ).toBe("Continue");
    expect(
      getConfiguratorCtaLabel("neck-label", {
        ...defaults,
        hasCustomLabel: true,
      }),
    ).toBe("Continue to sizes");
  });

  it("activates Reservation while payment is being prepared", () => {
    expect(getPaymentJourneyStep(false)).toBe("review");
    expect(getPaymentJourneyStep(true)).toBe("reserve");
  });
});
