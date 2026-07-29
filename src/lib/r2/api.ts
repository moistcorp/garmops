import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { getServerEnvironment } from "@/lib/config/env";
import { isFeatureEnabled } from "@/lib/config/featureFlags";
import { createClient } from "@/lib/supabase/server";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: message },
    { status, headers: noStoreHeaders },
  );
}

export function jsonPrivate(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, { status, headers: noStoreHeaders });
}

export function privateUploadsAvailable(): boolean {
  return isFeatureEnabled("R2_PRIVATE_UPLOADS_ENABLED");
}

export function hasExpectedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return (
      new URL(origin).origin ===
      new URL(getServerEnvironment().NEXT_PUBLIC_APP_URL).origin
    );
  } catch {
    return false;
  }
}

export async function authenticateFileApi() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user || !data.user.email_confirmed_at) {
    return { ok: false as const, response: jsonError("Unauthorized", 401) };
  }

  return { ok: true as const, supabase, user: data.user };
}
