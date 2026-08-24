"use client";

import { AlertTriangle } from "lucide-react";
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
  const checkingRef = useRef(false);
  const activeRequestRef = useRef<AbortController | null>(null);

  const checkBackend = useCallback(async () => {
    if (checkingRef.current) return;

    checkingRef.current = true;
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
      }
    }
  }, []);

  useEffect(() => {
    const initialCheck = window.setTimeout(() => void checkBackend(), 0);

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
      window.clearTimeout(initialCheck);
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
      className="relative z-[60] border-b border-amber-900/20 bg-amber-50 px-4 py-2 text-amber-950 sm:px-6"
      role="alert"
      aria-live="assertive"
      data-testid="backend-status-notice"
    >
      <div className="mx-auto flex max-w-7xl items-start gap-2 sm:items-center">
        <AlertTriangle
          className="mt-0.5 size-4 shrink-0 text-amber-700 sm:mt-0"
          aria-hidden="true"
        />
        <div className="min-w-0 text-xs leading-5 sm:flex sm:items-baseline sm:gap-2">
          <p className="shrink-0 font-semibold">Ordering is temporarily unavailable.</p>
          <p className="text-amber-900/70">
            You can keep browsing; accounts, saved designs, cart and checkout may be unavailable until service is restored.
          </p>
        </div>
      </div>
    </aside>
  );
}
