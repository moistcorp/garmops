"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { identifyAnalyticsUser, resetAnalyticsUser } from "@/lib/analytics/client";

export type CustomerSession = {
  loading: boolean;
  email: string | null;
  label: string | null;
  refresh: () => Promise<void>;
};

export function useCustomerSession(enabled: boolean): CustomerSession {
  const [loading, setLoading] = useState(enabled);
  const [email, setEmail] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!enabled) { setLoading(false); return; }
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setEmail(null); setLabel(null); resetAnalyticsUser(); return; }
      identifyAnalyticsUser(user.id);
      setEmail(user.email ?? null);
      const { data: profile } = await supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle();
      const metadataName = typeof user.user_metadata?.first_name === "string" ? user.user_metadata.first_name : null;
      setLabel(profile?.first_name?.trim() || metadataName?.trim() || user.email?.split("@")[0] || "Account");
    } catch {
      setEmail(null);
      setLabel(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    let subscription: { unsubscribe: () => void } | undefined;
    try {
      const { data } = createClient().auth.onAuthStateChange(() => { void refresh(); });
      subscription = data.subscription;
    } catch {
      setTimeout(() => { void refresh(); }, 0);
    }
    return () => subscription?.unsubscribe();
  }, [enabled, refresh]);
  return { loading, email, label, refresh };
}
