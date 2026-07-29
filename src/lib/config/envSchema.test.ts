import { describe, expect, it } from "vitest";

import { parseServerEnvironment } from "./envSchema";

describe("server environment validation", () => {
  it("supports secret-free development when rollout flags are off", () => {
    const environment = parseServerEnvironment({});

    expect(environment.APP_ENV).toBe("development");
    expect(environment.APP_TIMEZONE).toBe("Asia/Kolkata");
    expect(environment.NEXT_PUBLIC_ACCOUNTS_ENABLED).toBe(false);
    expect(environment.JOB_PROCESSING_BACKEND).toBe("postgres");
  });

  it("requires Supabase configuration when accounts are enabled", () => {
    expect(() =>
      parseServerEnvironment({
        NEXT_PUBLIC_ACCOUNTS_ENABLED: "true",
      })
    ).toThrow(
      "Invalid server environment configuration: AUTH_RATE_LIMIT_SALT, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_TURNSTILE_SITE_KEY, SUPABASE_SECRET_KEY, TURNSTILE_SECRET_KEY"
    );
  });

  it("accepts a complete public Supabase account configuration", () => {
    const environment = parseServerEnvironment({
      NEXT_PUBLIC_ACCOUNTS_ENABLED: "true",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_test",
      SUPABASE_SECRET_KEY: "sb_secret_local_test",
      AUTH_RATE_LIMIT_SALT: "local-test-rate-limit-salt",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
    });

    expect(environment.NEXT_PUBLIC_ACCOUNTS_ENABLED).toBe(true);
  });

  it("rejects deferred infrastructure flags", () => {
    expect(() =>
      parseServerEnvironment({
        ENABLE_WHATSAPP_NOTIFICATIONS: "true",
      })
    ).toThrow(
      "Invalid server environment configuration: ENABLE_WHATSAPP_NOTIFICATIONS"
    );
  });

  it("does not include secret values in validation errors", () => {
    const secret = "do-not-echo-this-value";

    expect(() =>
      parseServerEnvironment({
        NEXT_PUBLIC_ACCOUNTS_ENABLED: "true",
        NEXT_PUBLIC_SUPABASE_URL: secret,
      })
    ).toThrowError(
      expect.not.stringContaining(secret)
    );
  });
});
