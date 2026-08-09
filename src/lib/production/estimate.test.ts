import { describe, expect, it } from "vitest";
import { estimateProductionWindow } from "./estimate";

describe("production window", () => {
  it("uses the safe static fallback without configured capacity", () => {
    expect(estimateProductionWindow({ quantity: 50, requestedMode: "standard", now: new Date("2026-08-09T00:00:00Z") })).toMatchObject({ usedFallback: true, workingDays: 35 });
  });
  it("never promises earlier than the fallback", () => {
    expect(estimateProductionWindow({ quantity: 50, requestedMode: "rush", capacity: { dailyUnitCapacity: 1000, workingWeekdays: [1,2,3,4,5,6], blackoutDates: [] } }).workingDays).toBe(18);
  });
});
