const SENSITIVE_KEY = /authorization|cookie|email|phone|address|gstin|filename|file_url|signed|payu|hash|salt|token|payload|body/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? "[Redacted]" : redact(item)]));
}

export function redactSentryEvent<T>(event: T): T {
  return redact(event) as T;
}

export function captureOperationalError(error: unknown, input: { area: string; requestId?: string }) {
  Sentry.captureException(error, {
    tags: { area: input.area },
    extra: input.requestId ? { requestId: input.requestId } : undefined,
  });
}
import * as Sentry from "@sentry/nextjs";
