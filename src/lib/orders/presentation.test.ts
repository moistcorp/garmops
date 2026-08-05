import { describe, expect, it } from "vitest";

import { summarizeOrderItemPricing } from "./presentation";

describe("multi-item order presentation", () => {
  it("aggregates separate and duplicate product lines without collapsing them", () => {
    const summary = summarizeOrderItemPricing([
      {
        quantity: 50,
        lineTotalPaise: 2_500_000,
        productSnapshot: {
          configuredUnitPaise: 50_000,
          volumeDiscountPaise: 0,
          rushSurchargePaise: 0,
        },
      },
      {
        quantity: 100,
        lineTotalPaise: 4_725_000,
        productSnapshot: {
          configuredUnitPaise: 50_000,
          volumeDiscountPaise: 350_000,
          rushSurchargePaise: 75_000,
        },
      },
    ]);

    expect(summary).toEqual({
      configuredMerchandisePaise: 7_500_000,
      volumeDiscountPaise: 350_000,
      rushPaise: 75_000,
    });
  });
});
