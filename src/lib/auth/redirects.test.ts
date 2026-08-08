import { describe, expect, it } from "vitest";
import { decodeAuthNextCookie, safeInternalPath } from "./redirects";

describe("authentication return paths", () => {
  it("restores an encoded configurator delivery path", () => {
    const deliveryPath = "/configurator/cart/cart-123/shipping";
    expect(
      safeInternalPath(
        decodeAuthNextCookie(encodeURIComponent(deliveryPath)),
        "/account/orders",
      ),
    ).toBe(deliveryPath);
  });

  it("rejects external and malformed cookie destinations", () => {
    expect(safeInternalPath(decodeAuthNextCookie(encodeURIComponent("//evil.test")), "/account/orders"))
      .toBe("/account/orders");
    expect(decodeAuthNextCookie("%not-valid")).toBeUndefined();
  });
});
