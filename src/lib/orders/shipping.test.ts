import { describe, expect, it } from "vitest";
import { FREE_SHIPPING_PAISE, getShippingPaise } from "./shipping";

describe("canonical shipping", () => {
  it("is always zero for all current order kinds", () => {
    expect(FREE_SHIPPING_PAISE).toBe(0);
    expect(getShippingPaise()).toBe(0);
  });
});
