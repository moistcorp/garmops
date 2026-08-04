import { describe, expect, it } from "vitest";

import {
  CUSTOMER_PRODUCTION_STAGES,
  customerProductionTimeline,
} from "./productionTimeline";

describe("customerProductionTimeline", () => {
  it("uses the agreed simplified customer-facing stages", () => {
    expect(CUSTOMER_PRODUCTION_STAGES).toEqual([
      "Order received",
      "Artwork under review",
      "Approved for production",
      "Material preparation",
      "Printing or embroidery",
      "Stitching",
      "Quality check and packing",
      "Dispatched",
      "Delivered",
    ]);
  });

  it("starts at order received after verified payment", () => {
    const timeline = customerProductionTimeline("payment_confirmed");

    expect(timeline[0].state).toBe("current");
    expect(timeline[1].state).toBe("upcoming");
  });

  it("does not claim stitching is complete during decoration", () => {
    const timeline = customerProductionTimeline("printing_embroidery");

    expect(timeline[3].state).toBe("completed");
    expect(timeline[4].state).toBe("current");
    expect(timeline[5].state).toBe("upcoming");
  });

  it("marks production milestones complete once quality control begins", () => {
    const timeline = customerProductionTimeline("quality_check");

    expect(timeline[4].state).toBe("completed");
    expect(timeline[5].state).toBe("completed");
    expect(timeline[6].state).toBe("current");
  });

  it("preserves the last known production position while an order is on hold", () => {
    const timeline = customerProductionTimeline("on_hold", [
      "payment_confirmed",
      "printing_embroidery",
      "on_hold",
    ]);

    expect(timeline[4].state).toBe("current");
    expect(timeline[5].state).toBe("upcoming");
  });
});
