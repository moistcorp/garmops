import { describe, expect, it } from "vitest";

import { getVolumeDiscountMessage } from "./OrderBar";

describe("order bar volume discount copy", () => {
  it("keeps showing the applicable tier guidance", () => {
    expect(getVolumeDiscountMessage(60)).toBe(
      "Add 40 more units to unlock 7% off",
    );
  });

  it("shows the highest tier once it is reached", () => {
    expect(getVolumeDiscountMessage(1000)).toBe(
      "22% volume discount applied · Highest discount tier",
    );
  });
});
