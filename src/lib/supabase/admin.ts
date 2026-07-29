import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import { getServerEnvironment } from "@/lib/config/env";

export function createAdminClient() {
  const environment = getServerEnvironment();
  const secretKey =
    environment.SUPABASE_SECRET_KEY ??
    environment.SUPABASE_SERVICE_ROLE_KEY;

  if (!environment.NEXT_PUBLIC_SUPABASE_URL || !secretKey) {
    throw new Error("Supabase administrative configuration is unavailable");
  }

  return createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
