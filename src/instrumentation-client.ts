import { initializeAnalytics } from "@/lib/analytics/client";
import * as Sentry from "@sentry/nextjs";
import { redactSentryEvent } from "@/lib/monitoring/sentry";

initializeAnalytics();

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NEXT_PUBLIC_SENTRY_DSN !== undefined,
  sendDefaultPii: false,
  tracesSampleRate: 0.05,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend: redactSentryEvent,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
