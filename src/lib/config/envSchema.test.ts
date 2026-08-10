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
      "Invalid server environment configuration: AUTH_RATE_LIMIT_SALT, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_TURNSTILE_SITE_KEY, SUPABASE_SECRET_KEY, TURNSTILE_SECRET"
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
      TURNSTILE_SECRET: "1x0000000000000000000000000000000AA",
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

  it("requires accounts, Supabase, and exact R2 configuration for uploads", () => {
    expect(() =>
      parseServerEnvironment({
        R2_PRIVATE_UPLOADS_ENABLED: "true",
      })
    ).toThrow(
      "Invalid server environment configuration: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_URL, R2_ACCESS_KEY_ID, R2_ACCOUNT_ID, R2_PRIVATE_BUCKET, R2_PRIVATE_UPLOADS_ENABLED, R2_S3_ENDPOINT, R2_SECRET_ACCESS_KEY, SUPABASE_SECRET_KEY"
    );
  });

  it("accepts a complete private R2 configuration", () => {
    const environment = parseServerEnvironment({
      NEXT_PUBLIC_ACCOUNTS_ENABLED: "true",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_test",
      SUPABASE_SECRET_KEY: "sb_secret_local_test",
      AUTH_RATE_LIMIT_SALT: "local-test-rate-limit-salt",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      TURNSTILE_SECRET: "1x0000000000000000000000000000000AA",
      R2_PRIVATE_UPLOADS_ENABLED: "true",
      R2_ACCOUNT_ID: "account123",
      R2_ACCESS_KEY_ID: "r2_access",
      R2_SECRET_ACCESS_KEY: "r2_secret",
      R2_S3_ENDPOINT: "https://account123.r2.cloudflarestorage.com",
      R2_PRIVATE_BUCKET: "garmops-private-orders",
    });

    expect(environment.R2_PRIVATE_UPLOADS_ENABLED).toBe(true);
  });

  it("requires accounts and private uploads before cloud designs", () => {
    expect(() =>
      parseServerEnvironment({
        CLOUD_DESIGNS_ENABLED: "true",
      })
    ).toThrow(
      "Invalid server environment configuration: CLOUD_DESIGNS_ENABLED"
    );
  });

  it("accepts cloud designs when account and R2 dependencies are complete", () => {
    const environment = parseServerEnvironment({
      NEXT_PUBLIC_ACCOUNTS_ENABLED: "true",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_test",
      SUPABASE_SECRET_KEY: "sb_secret_local_test",
      AUTH_RATE_LIMIT_SALT: "local-test-rate-limit-salt",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      TURNSTILE_SECRET: "1x0000000000000000000000000000000AA",
      R2_PRIVATE_UPLOADS_ENABLED: "true",
      R2_ACCOUNT_ID: "account123",
      R2_ACCESS_KEY_ID: "r2_access",
      R2_SECRET_ACCESS_KEY: "r2_secret",
      R2_S3_ENDPOINT: "https://account123.r2.cloudflarestorage.com",
      R2_PRIVATE_BUCKET: "garmops-private-orders",
      CLOUD_DESIGNS_ENABLED: "true",
    });

    expect(environment.CLOUD_DESIGNS_ENABLED).toBe(true);
  });

  it("requires cloud designs before configurator checkout", () => {
    expect(() =>
      parseServerEnvironment({
        CONFIGURATOR_CHECKOUT_ENABLED: "true",
      })
    ).toThrow(
      "Invalid server environment configuration: CONFIGURATOR_CHECKOUT_ENABLED, CRON_SECRET, NEXT_PUBLIC_ACCOUNTS_ENABLED, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_URL, PAYMENT_SIGNING_SECRET, PAYU_MERCHANT_KEY, PAYU_SALT, SUPABASE_SECRET_KEY"
    );
  });

  it("rejects an R2 endpoint for another account", () => {
    expect(() =>
      parseServerEnvironment({
        R2_ACCOUNT_ID: "right-account",
        R2_S3_ENDPOINT:
          "https://wrong-account.r2.cloudflarestorage.com",
      })
    ).toThrow(
      "Invalid server environment configuration: R2_S3_ENDPOINT"
    );
  });

  it("accepts only an HTTPS origin for the public download base", () => {
    expect(() =>
      parseServerEnvironment({
        NEXT_PUBLIC_DOWNLOADS_BASE_URL:
          "https://downloads.garmops.com/nested",
      })
    ).toThrow(
      "Invalid server environment configuration: NEXT_PUBLIC_DOWNLOADS_BASE_URL"
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
