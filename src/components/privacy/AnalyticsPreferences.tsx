"use client";

import { useState, useSyncExternalStore } from "react";
import { ANALYTICS_CONSENT_KEY, setAnalyticsConsent } from "@/lib/analytics/client";

export default function AnalyticsPreferences() {
  const choice = useSyncExternalStore(
    (notify) => { window.addEventListener("garmops:analytics-consent", notify); return () => window.removeEventListener("garmops:analytics-consent", notify); },
    () => window.localStorage.getItem(ANALYTICS_CONSENT_KEY),
    () => null,
  );
  const [open, setOpen] = useState(false);
  const choose = (accepted: boolean) => {
    setAnalyticsConsent(accepted);
    setOpen(false);
  };
  return (
    <>
      {choice === null || open ? <section aria-label="Analytics preferences" className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-2xl rounded border border-black/10 bg-white p-4 shadow-xl">
        <p className="font-semibold">Optional analytics</p>
        <p className="mt-1 text-sm text-black/60">Help us understand product journeys. Ordering works without analytics, and session replay is off.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => choose(true)} className="techpack-button">Accept analytics</button>
          <button type="button" onClick={() => choose(false)} className="rounded border border-black/10 px-4 py-2 text-sm font-semibold">Reject analytics</button>
        </div>
      </section> : null}
      {choice !== null && !open ? <button type="button" onClick={() => setOpen(true)} className="fixed bottom-3 right-3 z-[90] rounded border border-black/10 bg-white px-3 py-2 text-xs shadow">Manage analytics</button> : null}
    </>
  );
}
