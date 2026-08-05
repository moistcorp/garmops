import { describe, expect, it } from "vitest";

import {
  getIndiaCalendarDate,
  getRequestedDeliveryDateError,
} from "./delivery";

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

describe("delivery date validation", () => {
  it("uses the current calendar date in India around the UTC day boundary", () => {
    const date = getIndiaCalendarDate(new Date("2026-08-05T20:00:00.000Z"));
    expect(isoDate(date)).toBe("2026-08-06");
  });

  it("accepts the currently available standard date", () => {
    const now = new Date("2026-08-05T06:00:00.000Z");
    const today = getIndiaCalendarDate(now);

    expect(
      getRequestedDeliveryDateError({
        deliveryType: "standard",
        requestedDeliveryDate: isoDate(addDays(today, 35)),
        now,
      }),
    ).toBeNull();
  });

  it("rejects a standard date calculated from an older saved draft", () => {
    const now = new Date("2026-08-05T06:00:00.000Z");
    const today = getIndiaCalendarDate(now);

    expect(
      getRequestedDeliveryDateError({
        deliveryType: "standard",
        requestedDeliveryDate: isoDate(addDays(today, 34)),
        now,
      }),
    ).toContain("no longer available");
  });

  it("applies the maximum custom-dye lead-time extension", () => {
    const now = new Date("2026-08-05T06:00:00.000Z");
    const today = getIndiaCalendarDate(now);

    expect(
      getRequestedDeliveryDateError({
        deliveryType: "rush",
        requestedDeliveryDate: isoDate(addDays(today, 33)),
        extraLeadTimeDays: 15,
        now,
      }),
    ).toBeNull();
  });

  it("requires flexible dates to remain on or after the current standard date", () => {
    const now = new Date("2026-08-05T06:00:00.000Z");
    const today = getIndiaCalendarDate(now);

    expect(
      getRequestedDeliveryDateError({
        deliveryType: "flexible",
        requestedDeliveryDate: isoDate(addDays(today, 34)),
        now,
      }),
    ).toContain("on or after");
  });
});
