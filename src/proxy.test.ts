import { describe, expect, it } from "vitest";

import { isStaffPortalPath } from "./proxy";

describe("Foundry route boundary", () => {
  it.each(["/analytics", "/analytics/overview", "/orders", "/orders/GAR-2026-000001"])(
    "recognizes %s as a staff route",
    (path) => {
      expect(isStaffPortalPath(path)).toBe(true);
    },
  );

  it.each(["/", "/pricing", "/products", "/account"])(
    "leaves %s on the public route surface",
    (path) => {
      expect(isStaffPortalPath(path)).toBe(false);
    },
  );
});
