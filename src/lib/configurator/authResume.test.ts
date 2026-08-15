import { describe, expect, it } from "vitest";
import {
  CONFIGURATOR_AUTH_RESUME_PARAM,
  configuratorAuthReturnPath,
  configuratorPathWithoutAuthResume,
  parseConfiguratorAuthResume,
} from "./authResume";

describe("configurator auth resume paths", () => {
  it("preserves the draft and cart context while returning to the active step", () => {
    const path = configuratorAuthReturnPath(
      "regular-fit-tee-200gsm",
      "draftId=draft-123&cartId=cart-456",
      "neck-label",
      "add-to-cart",
    );
    const url = new URL(path, "https://www.garmops.com");

    expect(url.pathname).toBe("/configurator/build/regular-fit-tee-200gsm");
    expect(url.searchParams.get("draftId")).toBe("draft-123");
    expect(url.searchParams.get("cartId")).toBe("cart-456");
    expect(url.searchParams.get("step")).toBe("neck-label");
    expect(url.searchParams.get(CONFIGURATOR_AUTH_RESUME_PARAM)).toBe("add-to-cart");
  });

  it("consumes only the one-time auth intent", () => {
    const path = configuratorPathWithoutAuthResume(
      "regular-fit-tee-200gsm",
      "draftId=draft-123&step=neck-label&afterAuth=add-to-cart",
    );
    const url = new URL(path, "https://www.garmops.com");

    expect(url.searchParams.get("draftId")).toBe("draft-123");
    expect(url.searchParams.get("step")).toBe("neck-label");
    expect(url.searchParams.has(CONFIGURATOR_AUTH_RESUME_PARAM)).toBe(false);
  });

  it("accepts only known resume intents", () => {
    expect(parseConfiguratorAuthResume("save-design")).toBe("save-design");
    expect(parseConfiguratorAuthResume("unknown")).toBeNull();
  });
});
