import { describe, expect, it } from "vitest";

import { shouldClearPaidSampleCart } from "./ClearPaidSampleCart";

describe("sample cart cleanup boundary", () => {
  it("clears only when the payment result is confirmed paid", () => {
    expect(shouldClearPaidSampleCart(true)).toBe(true);
    expect(shouldClearPaidSampleCart(false)).toBe(false);
  });
});
