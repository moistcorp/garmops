import { describe, expect, it } from "vitest";

import { roleCan } from "./permissions";
import {
  allowedNextStatusesForRole,
  ORDER_TRANSITIONS,
  PUBLIC_STATUS_BY_INTERNAL,
} from "./statuses";

describe("Phase 10 staff operations rules", () => {
  it("does not expose arbitrary state changes", () => {
    expect(ORDER_TRANSITIONS.reservation_paid).toEqual([
      "submitted_for_review",
      "cancelled",
      "on_hold",
    ]);
    expect(ORDER_TRANSITIONS.awaiting_payment).not.toContain("reservation_paid");
    expect(ORDER_TRANSITIONS.awaiting_payment).not.toContain("payment_failed");
    expect(ORDER_TRANSITIONS.payment_failed).not.toContain("awaiting_payment");
    expect(ORDER_TRANSITIONS.delivered).toEqual([]);
  });

  it("maps internal states to stable customer states", () => {
    expect(PUBLIC_STATUS_BY_INTERNAL.commercial_review).toBe("under_review");
    expect(PUBLIC_STATUS_BY_INTERNAL.production_queued).toBe("approved");
    expect(PUBLIC_STATUS_BY_INTERNAL.packing).toBe("quality_check");
  });

  it("uses a fulfilment path for paid sample purchases without artwork approval", () => {
    expect(
      allowedNextStatusesForRole(
        "submitted_for_review",
        "production",
        "sample_purchase",
      ),
    ).toEqual(["production_queued", "packing", "on_hold"]);
    expect(
      allowedNextStatusesForRole(
        "submitted_for_review",
        "artwork",
        "sample_purchase",
      ),
    ).toEqual(["needs_customer_action", "on_hold"]);
  });

  it("filters transitions by staff role", () => {
    expect(
      allowedNextStatusesForRole("submitted_for_review", "sales"),
    ).toContain("commercial_review");
    expect(
      allowedNextStatusesForRole("submitted_for_review", "production"),
    ).toEqual(["on_hold"]);
    expect(
      allowedNextStatusesForRole("in_production", "dispatch"),
    ).toEqual(["on_hold"]);
  });

  it("keeps sensitive actions role-limited", () => {
    expect(roleCan("read_only", "add_internal_note")).toBe(false);
    expect(roleCan("support", "send_customer_update")).toBe(true);
    expect(roleCan("finance", "retry_invoice_job")).toBe(true);
    expect(roleCan("sales", "change_file_visibility")).toBe(false);
    expect(roleCan("operations_admin", "view_audit")).toBe(true);
  });
});
