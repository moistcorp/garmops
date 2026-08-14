import "server-only";
import { PostHog } from "posthog-node";
import { getServerEnvironment } from "@/lib/config/env";
import { sanitizeAnalyticsProperties, type AnalyticsEvent, type AnalyticsProperties } from "./events";

let client: PostHog | undefined;

export async function customerAllowsAnalytics(identityId: string): Promise<boolean> { void identityId; return false; }

export function captureServerAnalytics(input: {
  event: AnalyticsEvent;
  identityId: string;
  consent: boolean;
  properties?: AnalyticsProperties;
}) {
  try {
    const environment = getServerEnvironment();
    if (!input.consent || !environment.POSTHOG_ENABLED || !environment.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;
    client ??= new PostHog(environment.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, {
      host: environment.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
    client.capture({
      distinctId: input.identityId,
      event: input.event,
      properties: sanitizeAnalyticsProperties(input.properties),
    });
  } catch {
    // Analytics is non-essential and must never affect ordering.
  }
}
