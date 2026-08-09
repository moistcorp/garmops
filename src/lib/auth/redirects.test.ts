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

  it("embeds the checkout return path in the canonical OAuth callback", () => {
    const callback = new URL(authCallbackUrl(
      "/configurator/cart/cart-123/shipping",
      "https://garmops.com/",
    ));
    expect(callback.origin).toBe("https://garmops.com");
    expect(callback.pathname).toBe("/auth/callback");
    expect(callback.searchParams.get("next")).toBe(
      "/configurator/cart/cart-123/shipping",
    );
  });
});
