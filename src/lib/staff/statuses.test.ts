import { describe, expect, it } from "vitest";

import {
  allowedNextStatusesForRole,
  ORDER_TRANSITIONS,
  PUBLIC_STATUS_BY_INTERNAL,
} from "./statuses";

describe("production staff operations rules", () => {
  it("uses the approved production transition graph", () => {
    expect(ORDER_TRANSITIONS.payment_confirmed).toEqual([
      "order_review",
      "on_hold",
      "cancelled",
    ]);
    expect(ORDER_TRANSITIONS.artwork_approved).toEqual([
      "production_approved",
      "on_hold",
      "cancelled",
    ]);
    expect(ORDER_TRANSITIONS.delivered).toEqual([]);
  });

  it("maps internal states to the simplified customer states", () => {
    expect(PUBLIC_STATUS_BY_INTERNAL.order_review).toBe("order_received");
    expect(PUBLIC_STATUS_BY_INTERNAL.production_approved).toBe(
      "approved_for_production",
    );
    expect(PUBLIC_STATUS_BY_INTERNAL.packing).toBe(
      "quality_check_and_packing",
    );
  });

  it("keeps cancellation and refunds out of normal status controls", () => {
    expect(
      allowedNextStatusesForRole("payment_confirmed", "founder"),
    ).toEqual(["order_review", "on_hold"]);
    expect(
      allowedNextStatusesForRole("payment_confirmed", "operations"),
    ).toEqual(["order_review", "on_hold"]);
    expect(
      allowedNextStatusesForRole("cancelled", "operations"),
    ).toEqual([]);
    expect(
      allowedNextStatusesForRole("cancelled", "founder"),
    ).toEqual([]);
  });

  it("keeps artwork approval in the dedicated review workflow", () => {
    expect(allowedNextStatusesForRole("order_review", "operations")).not.toContain("artwork_approved");
    expect(allowedNextStatusesForRole("artwork_pending", "founder")).not.toContain("artwork_approved");
  });

  it("allows Operations to progress normal production stages", () => {
    expect(
      allowedNextStatusesForRole("printing", "operations"),
    ).toEqual(["stitching", "on_hold"]);
    expect(
      allowedNextStatusesForRole("ready_to_dispatch", "operations"),
    ).toEqual(["dispatched", "packing", "on_hold"]);
  });

  it("only exposes a saved hold resume and hides it while cancellation is pending", () => {
    expect(ORDER_TRANSITIONS.on_hold).toEqual([]);
    expect(allowedNextStatusesForRole("on_hold", "operations", { holdFromStatus: "printing" })).toEqual(["printing"]);
    expect(allowedNextStatusesForRole("on_hold", "founder", { holdFromStatus: "printing", cancellationPending: true })).toEqual([]);
  });
});
