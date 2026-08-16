"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const HEALTH_CHECK_INTERVAL_MS = 60_000;
const HEALTH_CHECK_TIMEOUT_MS = 8_000;

type BackendAvailability = "unknown" | "available" | "unavailable";

export function backendAvailabilityFromResponse(
  response: Pick<Response, "ok" | "status">,
): BackendAvailability {
  if (response.ok) return "available";
  if (response.status === 503) return "unavailable";
  return "unknown";
}

export default function BackendStatusNotice() {
  const [availability, setAvailability] =
    useState<BackendAvailability>("unknown");
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const activeRequestRef = useRef<AbortController | null>(null);

  const checkBackend = useCallback(async () => {
    if (checkingRef.current) return;

    checkingRef.current = true;
    setChecking(true);
    const controller = new AbortController();
    activeRequestRef.current = controller;
    const timeout = window.setTimeout(
      () => controller.abort(),
      HEALTH_CHECK_TIMEOUT_MS,
    );

    try {
      const response = await fetch("/api/internal/integration-health", {
        cache: "no-store",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      const nextAvailability = backendAvailabilityFromResponse(response);

      // An unexpected response (or a browser network failure below) does not
      // prove that Medusa is down, so preserve the last confirmed state.
      if (nextAvailability !== "unknown") {
        setAvailability(nextAvailability);
      }
    } catch {
      // The frontend, the visitor's connection, or the request itself may have
      // failed. Only the explicit 503 above is safe to call backend downtime.
    } finally {
      window.clearTimeout(timeout);
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        checkingRef.current = false;
        setChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    void checkBackend();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkBackend();
    }, HEALTH_CHECK_INTERVAL_MS);
    const checkWhenOnline = () => void checkBackend();
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") void checkBackend();
    };

    window.addEventListener("online", checkWhenOnline);
    document.addEventListener("visibilitychange", checkWhenVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", checkWhenOnline);
      document.removeEventListener("visibilitychange", checkWhenVisible);
      const activeRequest = activeRequestRef.current;
      activeRequestRef.current = null;
      checkingRef.current = false;
      activeRequest?.abort();
    };
  }, [checkBackend]);

  if (availability !== "unavailable") return null;

  return (
    <aside
      className="relative z-[60] border-b border-amber-900/25 bg-amber-50 px-4 py-3 text-amber-950 sm:px-6"
      role="alert"
      aria-live="assertive"
      data-testid="backend-status-notice"
    >
      <div className="mx-auto flex max-w-7xl items-start gap-3 sm:items-center">
        <AlertTriangle
          className="mt-0.5 size-5 shrink-0 text-amber-700 sm:mt-0"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Ordering systems are temporarily offline</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-900/75 sm:text-sm">
            The website is online, but our commerce backend is not responding.
            You can keep browsing, but accounts, saved designs, carts and checkout
            may be unavailable until service is restored.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void checkBackend()}
          disabled={checking}
          className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-sm border border-amber-900/25 px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors hover:bg-amber-100 disabled:opacity-60"
        >
          <RefreshCw
            className={`size-3.5 ${checking ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">{checking ? "Checking" : "Check again"}</span>
          <span className="sm:hidden">{checking ? "Checking" : "Retry"}</span>
        </button>
      </div>
    </aside>
  );
}
