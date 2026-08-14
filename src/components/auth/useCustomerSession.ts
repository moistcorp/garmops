"use client";

import { useCallback, useEffect, useState } from "react";
import { identifyAnalyticsUser, resetAnalyticsUser } from "@/lib/analytics/client";

export type CustomerSession = {
  loading: boolean;
  email: string | null;
  label: string | null;
  refresh: () => Promise<void>;
};

type SessionBody = { customer?: { id?: string; email?: string; first_name?: string; last_name?: string }; user?: { id?: string; email?: string; first_name?: string; last_name?: string } };

export function useCustomerSession(enabled: boolean): CustomerSession {
  const [loading, setLoading] = useState(enabled);
  const [email, setEmail] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!enabled) { setLoading(false); return; }
    try {
      const response = await fetch("/api/medusa/auth/session", { cache: "no-store" });
      if (!response.ok) { setEmail(null); setLabel(null); resetAnalyticsUser(); return; }
      const body = await response.json() as SessionBody;
      const identity = body.customer ?? body.user;
      if (!identity?.email) { setEmail(null); setLabel(null); resetAnalyticsUser(); return; }
      identifyAnalyticsUser(identity.id ?? identity.email);
      setEmail(identity.email);
      setLabel((identity.first_name ?? identity.email.split("@")[0]).trim() || "Account");
    } catch {
      setEmail(null); setLabel(null);
    } finally { setLoading(false); }
  }, [enabled]);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  return { loading, email, label, refresh };
}
