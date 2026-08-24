"use client";

import Script from "next/script";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "light";
      appearance: "interaction-only";
      size: "flexible";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export default function TurnstileWidget({
  action,
  resetToken,
  onToken,
}: {
  action: string;
  resetToken: number;
  onToken?: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [widgetError, setWidgetError] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const updateToken = useCallback(
    (value: string) => {
      setToken(value);
      onToken?.(value);
    },
    [onToken],
  );

  const renderWidget = useCallback(() => {
    if (!siteKey || !window.turnstile || !containerRef.current || widgetId.current) {
      return;
    }
    try {
      setWidgetError(false);
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        theme: "light",
        appearance: "interaction-only",
        size: "flexible",
        callback: (value) => {
          setWidgetError(false);
          updateToken(value);
        },
        "expired-callback": () => updateToken(""),
        "error-callback": () => {
          updateToken("");
          setWidgetError(true);
        },
      });
    } catch {
      widgetId.current = null;
      updateToken("");
      setWidgetError(true);
    }
  }, [action, siteKey, updateToken]);

  useEffect(() => {
    let cancelled = false;
    if (widgetId.current && window.turnstile) {
      let failed = false;
      try {
        window.turnstile.reset(widgetId.current);
      } catch {
        widgetId.current = null;
        failed = true;
      }
      queueMicrotask(() => {
        if (cancelled) return;
        updateToken("");
        setWidgetError(failed);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [resetToken, updateToken]);

  useEffect(
    () => () => {
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          // A blocked third-party widget must not break route cleanup.
        }
        widgetId.current = null;
      }
    },
    [],
  );

  if (!siteKey) {
    return (
      <p role="alert" className="text-xs text-red-700">
        Security verification is not configured.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderWidget}
        onReady={renderWidget}
        onError={() => setWidgetError(true)}
      />
      <div
        role="status"
        aria-live="polite"
        className={`flex min-h-10 items-center gap-2 rounded-sm border px-3 py-2 text-xs font-medium ${
          token
            ? "border-emerald-700/18 bg-emerald-50/65 text-emerald-800"
            : "border-(--color-control-border) bg-(--color-cream-soft)/45 text-(--text-primary)/58"
        }`}
      >
        {token ? (
          <CheckCircle2 size={15} strokeWidth={2.4} className="shrink-0" aria-hidden="true" />
        ) : (
          <LoaderCircle size={15} className="shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        )}
        <span>{token ? "Security check complete" : "Checking security…"}</span>
      </div>
      <div
        ref={containerRef}
        className="cf-turnstile flex max-w-full items-center justify-center overflow-hidden rounded-sm empty:hidden"
        data-action="turnstile-spin-v2"
      />
      <input type="hidden" name="cf-turnstile-response" value={token} />
      {widgetError ? (
        <p role="alert" className="text-xs leading-relaxed text-red-700">
          Security verification could not load. Check your browser privacy
          settings, then reload this page.
        </p>
      ) : null}
    </div>
  );
}
