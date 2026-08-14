"use client";

import { useCallback, useEffect, useState } from "react";
import { identifyAnalyticsUser, resetAnalyticsUser } from "@/lib/analytics/client";

export type CustomerSession = {
  loading: boolean;
  email: string | null;
  label: string | null;
  refresh: () => Promise<boolean>;
};

type SessionBody = { customer?: { id?: string; email?: string; first_name?: string; last_name?: string }; user?: { id?: string; email?: string; first_name?: string; last_name?: string } };

export function useCustomerSession(enabled: boolean): CustomerSession {
  const [loading, setLoading] = useState(enabled);
  const [email, setEmail] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!enabled) { setLoading(false); return false; }
    try {
      const response = await fetch("/api/medusa/store/customers/me", { cache: "no-store" });
      if (!response.ok) { setEmail(null); setLabel(null); resetAnalyticsUser(); return false; }
      const body = await response.json() as SessionBody;
      const identity = body.customer ?? body.user;
      if (!identity?.email) { setEmail(null); setLabel(null); resetAnalyticsUser(); return false; }
      identifyAnalyticsUser(identity.id ?? identity.email);
      setEmail(identity.email);
      setLabel((identity.first_name ?? identity.email.split("@")[0]).trim() || "Account");
      return true;
    } catch {
      setEmail(null); setLabel(null);
      return false;
    } finally { setLoading(false); }
  }, [enabled]);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  return { loading, email, label, refresh };
}
