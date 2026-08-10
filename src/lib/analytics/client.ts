"use client";

import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import { sanitizeAnalyticsProperties, type AnalyticsEvent, type AnalyticsProperties } from "./events";

export const ANALYTICS_CONSENT_KEY = "garmops_analytics_consent";

export function analyticsConsent(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(ANALYTICS_CONSENT_KEY) === "accepted";
}

export function initializeAnalytics() {
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true") return;

  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!token) {
    if (process.env.NODE_ENV === "development") {
      throw new Error("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured");
    }
    return;
  }
  if (!host) {
    if (process.env.NODE_ENV === "development") {
      throw new Error("NEXT_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_HOST is configured");
    }
    return;
  }
  if (!analyticsConsent() || posthog.__loaded) return;

  posthog.init(token, {
    api_host: host,
    defaults: "2026-01-30",
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    person_profiles: "identified_only",
  });
}

export function setAnalyticsConsent(accepted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ANALYTICS_CONSENT_KEY, accepted ? "accepted" : "rejected");
  document.cookie = `${ANALYTICS_CONSENT_KEY}=${accepted ? "accepted" : "rejected"}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
  if (accepted) {
    initializeAnalytics();
    if (posthog.__loaded) posthog.opt_in_capturing();
  }
  else {
    if (posthog.__loaded) posthog.opt_out_capturing();
    posthog.reset();
  }
  window.dispatchEvent(new Event("garmops:analytics-consent"));
  void syncAnalyticsPreference(accepted);
}

export async function syncAnalyticsPreference(accepted: boolean) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("customer_privacy_preferences").upsert({
      customer_user_id: user.id,
      analytics_enabled: accepted,
      updated_at: new Date().toISOString(),
    }, { onConflict: "customer_user_id" });
  } catch {
    // Consent remains effective locally even if account preference sync is unavailable.
  }
}

export function captureAnalytics(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  if (!analyticsConsent()) return;
  initializeAnalytics();
  if (posthog.__loaded) posthog.capture(event, sanitizeAnalyticsProperties(properties));
}

export function captureAnalyticsException(error: unknown) {
  if (!analyticsConsent()) return;
  initializeAnalytics();
  if (posthog.__loaded) posthog.captureException(error);
}

export type AnalyticsPersonProperties = {
  email?: string;
  name?: string;
};

export function identifyAnalyticsUser(
  supabaseUserId: string,
  personProperties: AnalyticsPersonProperties = {},
) {
  if (!analyticsConsent() || !/^[0-9a-f-]{36}$/i.test(supabaseUserId)) return;
  initializeAnalytics();
  if (posthog.__loaded) posthog.identify(supabaseUserId, personProperties);
}

export function resetAnalyticsUser() {
  if (posthog.__loaded) posthog.reset();
}
