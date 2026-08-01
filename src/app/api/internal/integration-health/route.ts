import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getServerEnvironment } from "@/lib/config/env";
import { isFeatureEnabled } from "@/lib/config/featureFlags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorised(request: NextRequest): boolean {
  const configured = getServerEnvironment().CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || !supplied) return false;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Authenticated configuration/rollout probe for monitoring and deployment checks. */
export function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const environment = getServerEnvironment();
  return NextResponse.json(
    {
      status: "ok",
      environment: environment.APP_ENV,
      jobBackend: environment.JOB_PROCESSING_BACKEND,
      features: {
        accounts: isFeatureEnabled("NEXT_PUBLIC_ACCOUNTS_ENABLED"),
        staff: isFeatureEnabled("STAFF_PORTAL_ENABLED"),
        durableCustomCheckout: isFeatureEnabled("DURABLE_CUSTOM_CHECKOUT_ENABLED"),
        durableSampleCheckout: isFeatureEnabled("DURABLE_SAMPLE_CHECKOUT_ENABLED"),
        zoho: isFeatureEnabled("ZOHO_INVOICE_AUTOMATION_ENABLED"),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
