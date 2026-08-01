import { describe, expect, it } from "vitest";

import {
  CUSTOMER_PRODUCTION_STAGES,
  customerProductionTimeline,
} from "./productionTimeline";

describe("customerProductionTimeline", () => {
  it("uses the agreed customer-facing production stages", () => {
    expect(CUSTOMER_PRODUCTION_STAGES).toEqual([
      "Order received",
      "Payment confirmed",
      "Artwork under review",
      "Artwork approved",
      "Fabric and trims prepared",
      "Printing or embroidery",
      "Stitching and finishing",
      "Quality check",
      "Dispatched",
      "Delivered",
    ]);
  });

  it("shows payment as in progress for an unpaid received order", () => {
    const timeline = customerProductionTimeline("awaiting_payment");

    expect(timeline[0].state).toBe("completed");
    expect(timeline[1].state).toBe("current");
    expect(timeline[2].state).toBe("upcoming");
  });

  it("does not claim stitching is complete while decoration is in production", () => {
    const timeline = customerProductionTimeline("in_production");

    expect(timeline[4].state).toBe("completed");
    expect(timeline[5].state).toBe("current");
    expect(timeline[6].state).toBe("upcoming");
  });

  it("marks production milestones complete once quality control begins", () => {
    const timeline = customerProductionTimeline("quality_control");

    expect(timeline[5].state).toBe("completed");
    expect(timeline[6].state).toBe("completed");
    expect(timeline[7].state).toBe("current");
  });

  it("preserves the last known production position while an order is on hold", () => {
    const timeline = customerProductionTimeline("on_hold", [
      "reservation_paid",
      "in_production",
      "on_hold",
    ]);

    expect(timeline[5].state).toBe("current");
    expect(timeline[6].state).toBe("upcoming");
  });
});
