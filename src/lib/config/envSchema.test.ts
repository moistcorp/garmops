import { describe, expect, it } from "vitest";

import { parseServerEnvironment } from "./envSchema";

describe("server environment", () => {
  it("defaults to the local Medusa customer surface", () => {
    const environment = parseServerEnvironment({});
    expect(environment.NEXT_PUBLIC_MEDUSA_BACKEND_URL).toBe("http://localhost:9000");
    expect(environment.APP_SURFACE).toBe("customer");
  });

  it("rejects a surface URL mismatch", () => {
    expect(() => parseServerEnvironment({ NEXT_PUBLIC_APP_URL: "http://localhost:3001" })).toThrow(
      "NEXT_PUBLIC_APP_URL",
    );
  });

  it("requires analytics credentials only when enabled", () => {
    expect(() => parseServerEnvironment({ POSTHOG_ENABLED: "true" })).toThrow(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN",
    );
    expect(parseServerEnvironment({ POSTHOG_ENABLED: "false" }).POSTHOG_ENABLED).toBe(false);
  });
});
