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

});
