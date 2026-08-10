import { describe, expect, it } from "vitest";
import { estimateProductionPlan, estimateProductionWindow } from "./estimate";

describe("production window", () => {
  it("uses the safe static fallback without configured capacity", () => {
    expect(estimateProductionWindow({ quantity: 50, requestedMode: "standard", now: new Date("2026-08-09T00:00:00Z") })).toMatchObject({ usedFallback: true, workingDays: 35 });
  });
  it("never promises earlier than the fallback", () => {
    expect(estimateProductionWindow({ quantity: 50, requestedMode: "rush", capacity: { dailyUnitCapacity: 1000, workingWeekdays: [1,2,3,4,5,6], blackoutDates: [] } }).workingDays).toBe(18);
  });

  it("uses category plus technique before category, technique, and global rules", () => {
    const plan = estimateProductionPlan({
      items: [{ productCategory: "tee", quantity: 10, techniques: ["dtf"] }],
      requestedMode: "standard",
      capacity: {
        workingWeekdays: [1, 2, 3, 4, 5],
        blackoutDates: [],
        capacityRules: [
          { productCategory: null, technique: null, dailyUnitCapacity: 100 },
          { productCategory: "tee", technique: null, dailyUnitCapacity: 90 },
          { productCategory: null, technique: "dtf", dailyUnitCapacity: 80 },
          { productCategory: "tee", technique: "dtf", dailyUnitCapacity: 1 },
        ],
        leadTimeRules: [{ productCategory: "tee", technique: "dtf", customDyeExtraDays: 0, setupBufferDays: 0, qcDispatchBufferDays: 0, rushEligible: true }],
      },
      now: new Date("2026-08-10T00:00:00Z"),
    });
    expect(plan.paths[0].capacityRule?.dailyUnitCapacity).toBe(1);
  });

  it("requires every multi-item path to be rush eligible", () => {
    const plan = estimateProductionPlan({
      items: [
        { productCategory: "tee", quantity: 100, techniques: ["screen_print"] },
        { productCategory: "hoodie", quantity: 50, techniques: ["dtf"] },
      ],
      requestedMode: "rush",
      capacity: {
        workingWeekdays: [1, 2, 3, 4, 5],
        blackoutDates: [],
        dailyUnitCapacity: 100,
        leadTimeRules: [
          { productCategory: "tee", technique: "screen_print", customDyeExtraDays: 0, setupBufferDays: 0, qcDispatchBufferDays: 0, rushEligible: true },
          { productCategory: "hoodie", technique: "dtf", customDyeExtraDays: 0, setupBufferDays: 0, qcDispatchBufferDays: 0, rushEligible: false },
        ],
      },
    });
    expect(plan.rushEligible).toBe(false);
    expect(plan.requestedDateFeasible).toBe(false);
  });

  it("skips weekends and blackout dates", () => {
    const plan = estimateProductionPlan({
      items: [{ productCategory: "tee", quantity: 1 }],
      requestedMode: "standard",
      requestedDate: "2026-09-30",
      capacity: { workingWeekdays: [1, 2, 3, 4, 5], blackoutDates: ["2026-08-11"] },
      now: new Date("2026-08-10T00:00:00Z"),
    });
    expect(plan.earliestStandardDate).toBe("2026-09-29");
    expect(plan.requestedDateFeasible).toBe(true);
  });
});
