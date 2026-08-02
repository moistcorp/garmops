/**
 * Server rollout gates for backend integrations.
 *
 * This module deliberately fails closed: an unset, misspelled, or unexpected
 * value is disabled. Public presentation may mirror a NEXT_PUBLIC_ flag later,
 * but route handlers and server actions must always enforce these server-side.
 */

export const FEATURE_FLAG_NAMES = [
  "NEXT_PUBLIC_ACCOUNTS_ENABLED",
  "NEXT_PUBLIC_CLOUD_DESIGNS_ENABLED",
  "STAFF_PORTAL_ENABLED",
  "R2_PRIVATE_UPLOADS_ENABLED",
  "CLOUD_DESIGNS_ENABLED",
  "DURABLE_CUSTOM_CHECKOUT_ENABLED",
  "DURABLE_SAMPLE_CHECKOUT_ENABLED",
  "ENABLE_REALTIME_ORDER_UPDATES",
  "ENABLE_WHATSAPP_NOTIFICATIONS",
  "ENABLE_SMS_NOTIFICATIONS",
] as const;

export type FeatureFlagName = (typeof FEATURE_FLAG_NAMES)[number];
export type FeatureFlags = Readonly<Record<FeatureFlagName, boolean>>;
type EnvironmentInput = Readonly<Record<string, string | undefined>>;

function isExplicitlyEnabled(value: string | undefined): boolean {
  return value === "true";
}

export function readFeatureFlags(
  environment: EnvironmentInput = process.env
): FeatureFlags {
  return Object.freeze(
    Object.fromEntries(
      FEATURE_FLAG_NAMES.map((name) => [
        name,
        isExplicitlyEnabled(environment[name]),
      ])
    ) as Record<FeatureFlagName, boolean>
  );
}

export function isFeatureEnabled(
  name: FeatureFlagName,
  environment: EnvironmentInput = process.env
): boolean {
  return isExplicitlyEnabled(environment[name]);
}
