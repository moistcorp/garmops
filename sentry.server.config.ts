import * as Sentry from "@sentry/nextjs";
import { redactSentryEvent } from "@/lib/monitoring/sentry";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.SENTRY_ENABLED === "true",
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  beforeSend: redactSentryEvent,
});
