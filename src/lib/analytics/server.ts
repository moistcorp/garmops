import "server-only";
import { PostHog } from "posthog-node";
import { getServerEnvironment } from "@/lib/config/env";
import { sanitizeAnalyticsProperties, type AnalyticsEvent, type AnalyticsProperties } from "./events";

let client: PostHog | undefined;

export async function customerAllowsAnalytics(supabaseUserId: string): Promise<boolean> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data } = await createAdminClient()
      .from("customer_privacy_preferences")
      .select("analytics_enabled")
      .eq("customer_user_id", supabaseUserId)
      .maybeSingle();
    return data?.analytics_enabled === true;
  } catch {
    return false;
  }
}

export async function captureServerAnalytics(input: {
  event: AnalyticsEvent;
  supabaseUserId: string;
  consent: boolean;
  properties?: AnalyticsProperties;
}) {
  try {
    const environment = getServerEnvironment();
    if (
      !input.consent ||
      !environment.POSTHOG_ENABLED ||
      !environment.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ||
      !environment.NEXT_PUBLIC_POSTHOG_HOST
    ) return;
    client ??= new PostHog(environment.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, {
      host: environment.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
    client.capture({
      distinctId: input.supabaseUserId,
      event: input.event,
      properties: sanitizeAnalyticsProperties(input.properties),
    });
    await client.flush();
  } catch {
    // Analytics is non-essential and must never affect ordering.
  }
}
