import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { getServerEnvironment } from "@/lib/config/env";
import { isFeatureEnabled } from "@/lib/config/featureFlags";
import { createClient } from "@/lib/supabase/server";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export function designJsonError(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    { error: message, ...extra },
    { status, headers: noStoreHeaders },
  );
}

export function designJson(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, { status, headers: noStoreHeaders });
}

export function cloudDesignsAvailable(): boolean {
  return isFeatureEnabled("CLOUD_DESIGNS_ENABLED");
}

export function hasExpectedDesignOrigin(request: NextRequest): boolean {
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
export async function authenticateDesignApi() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user || !data.user.email_confirmed_at) {
    return {
      ok: false as const,
      response: designJsonError("Unauthorized", 401),
    };
  }

  return { ok: true as const, supabase, user: data.user };
}

export async function readDesignJson(
  request: NextRequest,
  maximumBytes = 2_300_000,
): Promise<{ ok: true; value: unknown } | { ok: false; response: NextResponse }> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    !Number.isFinite(contentLength) ||
    contentLength < 0 ||
    contentLength > maximumBytes
  ) {
    return {
      ok: false,
      response: designJsonError("Request is too large", 413),
    };
  }

  try {
    return { ok: true, value: await request.json() };
  } catch {
    return {
      ok: false,
      response: designJsonError("Invalid design request", 400),
    };
  }
}
