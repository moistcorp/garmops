import { describe, expect, it } from "vitest";

import { backendAvailabilityFromResponse } from "./BackendStatusNotice";

describe("backendAvailabilityFromResponse", () => {
  it("marks a successful backend probe as available", () => {
    expect(backendAvailabilityFromResponse({ ok: true, status: 200 })).toBe(
      "available",
    );
  });

  it("marks the integration health 503 as backend downtime", () => {
    expect(backendAvailabilityFromResponse({ ok: false, status: 503 })).toBe(
      "unavailable",
    );
  });

  it("does not misdiagnose unrelated frontend errors as backend downtime", () => {
    expect(backendAvailabilityFromResponse({ ok: false, status: 404 })).toBe(
      "unknown",
    );
  });
});
