import { describe, expect, it } from "vitest";
import { authCallbackUrl, decodeAuthNextCookie, safeInternalPath } from "./redirects";

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

  it("uses a stable canonical OAuth callback", () => {
    const callback = new URL(authCallbackUrl("https://www.garmops.com/"));
    expect(callback.origin).toBe("https://www.garmops.com");
    expect(callback.pathname).toBe("/auth/callback");
    expect(callback.search).toBe("");
  });
});
