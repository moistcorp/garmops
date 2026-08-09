import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getServerEnvironment } from "@/lib/config/env";
import { isFeatureEnabled } from "@/lib/config/featureFlags";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestIdFrom, withRequestId } from "@/lib/http/requestId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorised(request: NextRequest): boolean {
  const configured = getServerEnvironment().CRON_SECRET;
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!configured || !supplied) return false;

  const expected = Buffer.from(configured);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function freshCompletedRun(
  run: { status: string; started_at: string } | undefined,
  maximumAgeMinutes: number,
): boolean {
  return Boolean(
    run &&
    run.status === "completed" &&
    Date.now() - new Date(run.started_at).getTime() <= maximumAgeMinutes * 60_000,
  );
}

/** Authenticated deployment, queue and recurring-job health for uptime checks. */
export async function GET(request: NextRequest) {
  const requestId = requestIdFrom(request);
  if (!authorised(request)) {
    return withRequestId(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), requestId);
  }

  const environment = getServerEnvironment();
  const admin = createAdminClient();
  const [runsResult, queueResult, failedJobsResult, pendingPaymentsResult] = await Promise.all([
    admin
      .from("system_job_runs")
      .select("job_name, status, trigger_source, started_at, completed_at, error_message")
      .order("started_at", { ascending: false })
      .limit(20),
    admin
      .from("integration_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued"),
    admin
      .from("integration_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ["retryable_failure", "permanent_failure"]),
    admin
      .from("custom_checkout_payment_attempts")
      .select("id", { count: "exact", head: true })
      .in("status", ["initiated", "pending"]),
  ]);

  const databaseHealthy =
    !runsResult.error &&
    !queueResult.error &&
    !failedJobsResult.error &&
    !pendingPaymentsResult.error;
  const runs = runsResult.data ?? [];
  const latestIntegration = runs.find(
    (run) => run.job_name === "integration_jobs" && run.trigger_source === "cron",
  );
  const latestPayu = runs.find(
    (run) => run.job_name === "payu_reconciliation" && run.trigger_source === "cron",
  );
  const integrationHealthy = freshCompletedRun(latestIntegration, 15);
  const payuHealthy = freshCompletedRun(latestPayu, 30);
  const healthy =
    databaseHealthy &&
    integrationHealthy &&
    payuHealthy &&
    (failedJobsResult.count ?? 0) === 0;
  const scannerHealth = environment.MALWARE_SCANNING_ENABLED && environment.MALWARE_SCANNER_URL
    ? await fetch(new URL("/health", environment.MALWARE_SCANNER_URL), { cache: "no-store", signal: AbortSignal.timeout(3_000) }).then(response => response.ok).catch(() => false)
    : null;
  const overallHealthy = healthy && scannerHealth !== false;

  return withRequestId(NextResponse.json(
    {
      status: overallHealthy ? "ok" : "degraded",
      environment: environment.APP_ENV,
      jobBackend: environment.JOB_PROCESSING_BACKEND,
      jobs: {
        integrationProcessor: latestIntegration ?? null,
        payuReconciliation: latestPayu ?? null,
        queuedCount: queueResult.count ?? null,
        failedCount: failedJobsResult.count ?? null,
        pendingPaymentCount: pendingPaymentsResult.count ?? null,
        malwareScannerHealthy: scannerHealth,
      },
      features: {
        accounts: isFeatureEnabled("NEXT_PUBLIC_ACCOUNTS_ENABLED"),
        cloudDesignsUi: isFeatureEnabled("NEXT_PUBLIC_CLOUD_DESIGNS_ENABLED"),
        cloudDesignsApi: isFeatureEnabled("CLOUD_DESIGNS_ENABLED"),
        staff: isFeatureEnabled("STAFF_PORTAL_ENABLED"),
        privateUploads: isFeatureEnabled("R2_PRIVATE_UPLOADS_ENABLED"),
        durableCustomCheckout: isFeatureEnabled("DURABLE_CUSTOM_CHECKOUT_ENABLED"),
        durableSampleCheckout: isFeatureEnabled("DURABLE_SAMPLE_CHECKOUT_ENABLED"),
      },
      errors: [
        runsResult.error?.message,
        queueResult.error?.message,
        failedJobsResult.error?.message,
        pendingPaymentsResult.error?.message,
      ].filter(Boolean),
    },
    {
      status: overallHealthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  ), requestId);
}
