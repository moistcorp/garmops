"use client";

import posthog from "posthog-js";
import { sanitizeAnalyticsProperties, type AnalyticsEvent, type AnalyticsProperties } from "./events";

export const ANALYTICS_CONSENT_KEY = "garmops_analytics_consent";

export function analyticsConsent(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(ANALYTICS_CONSENT_KEY) === "accepted";
}

export function initializeAnalytics() {
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true" || !analyticsConsent()) return;
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token || posthog.__loaded) return;
  posthog.init(token, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    persistence: "localStorage+cookie",
    person_profiles: "identified_only",
  });
  posthog.stopSessionRecording();
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
  void accepted;
}

export function captureAnalytics(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  if (!analyticsConsent()) return;
  initializeAnalytics();
  if (posthog.__loaded) posthog.capture(event, sanitizeAnalyticsProperties(properties));
}

export function identifyAnalyticsUser(identityId: string) {
  if (!analyticsConsent() || !identityId) return;
  initializeAnalytics();
  if (posthog.__loaded) posthog.identify(identityId);
}

export function resetAnalyticsUser() {
  if (posthog.__loaded) posthog.reset();
}
