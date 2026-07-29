import { describe, expect, it } from "vitest";

import {
  FEATURE_FLAG_NAMES,
  isFeatureEnabled,
  readFeatureFlags,
} from "./featureFlags";

describe("backend feature flags", () => {
  it("fails closed when flags are absent", () => {
    const flags = readFeatureFlags({});

    for (const name of FEATURE_FLAG_NAMES) {
      expect(flags[name]).toBe(false);
    }
  });

  it("enables only an exact true value", () => {
    expect(isFeatureEnabled("STAFF_PORTAL_ENABLED", {
      STAFF_PORTAL_ENABLED: "true",
    })).toBe(true);
    expect(isFeatureEnabled("STAFF_PORTAL_ENABLED", {
      STAFF_PORTAL_ENABLED: "TRUE",
    })).toBe(false);
    expect(isFeatureEnabled("STAFF_PORTAL_ENABLED", {
      STAFF_PORTAL_ENABLED: "1",
    })).toBe(false);
  });
});
