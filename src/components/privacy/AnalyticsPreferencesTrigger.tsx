"use client";

import { OPEN_ANALYTICS_PREFERENCES_EVENT } from "./analyticsPreferencesEvents";

export default function AnalyticsPreferencesTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_ANALYTICS_PREFERENCES_EVENT))}
      className={`text-left${className ? ` ${className}` : ""}`}
    >
      Cookie settings
    </button>
  );
}
