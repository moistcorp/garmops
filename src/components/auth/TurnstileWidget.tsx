"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "light";
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
    widgetId.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      theme: "light",
      callback: updateToken,
      "expired-callback": () => updateToken(""),
      "error-callback": () => updateToken(""),
    });
  }, [action, siteKey, updateToken]);

  useEffect(() => {
    if (widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      updateToken("");
    }
  }, [resetToken, updateToken]);

  useEffect(
    () => () => {
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
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
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderWidget}
        onReady={renderWidget}
      />
      <div
        ref={containerRef}
        className="techpack-control cf-turnstile flex min-h-[65px] items-center overflow-hidden rounded-[4px] px-4 py-3"
        data-action="turnstile-spin-v2"
      />
      <input type="hidden" name="cf-turnstile-response" value={token} />
    </>
  );
}
