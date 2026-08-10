import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getServerEnvironment } from "@/lib/config/env";
import { finishSystemJobRun, startSystemJobRun } from "@/lib/jobs/health";
import {
  reconcileCheckoutPayuAttempt,
  reconcilePayuAttempt,
} from "@/lib/domain/payments/processPayuEvent";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorised(request: NextRequest): boolean {
  const configured = getServerEnvironment().CRON_SECRET;
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!configured || !supplied) return false;

  const configuredBytes = Buffer.from(configured);
  const suppliedBytes = Buffer.from(supplied);
  return (
    configuredBytes.length === suppliedBytes.length &&
    timingSafeEqual(configuredBytes, suppliedBytes)
  );
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = await startSystemJobRun({ jobName: "payu_reconciliation", triggerSource: "cron" });
  const environment = getServerEnvironment();
  const admin = createAdminClient();
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const createdAfter = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await admin
    .from("payment_attempts")
    .select("id")
    .in("status", ["initiated", "pending"])
    .lt("updated_at", staleBefore)
    .gte("created_at", createdAfter)
    .order("updated_at")
    .limit(Math.min(environment.JOB_BATCH_SIZE, 50));
  if (error) {
    console.error("PayU reconciliation query failed", {
      error: error.message,
    });
    await finishSystemJobRun({ runId, status: "failed", error: error.message, summary: { checked: 0, errors: 1 } });
    return NextResponse.json(
      { error: "Reconciliation query failed", runId },
      { status: 500 },
    );
  }

  const { data: checkoutData, error: checkoutError } = await admin
    .from("checkout_payment_attempts")
    .select("id")
    .in("status", ["initiated", "pending"])
    .lt("updated_at", staleBefore)
    .gte("created_at", createdAfter)
    .order("updated_at")
    .limit(Math.min(environment.JOB_BATCH_SIZE, 50));
  if (checkoutError) {
    console.error("Configurator checkout PayU reconciliation query failed", {
      error: checkoutError.message,
    });
  }

  const summary = {
    checked: 0,
    success: 0,
    pending: 0,
    failure: 0,
    errors: checkoutError ? 1 : 0,
  };

  for (const attempt of data ?? []) {
    summary.checked += 1;
    try {
      const result = await reconcilePayuAttempt(attempt.id);
      if (result.outcome === "success") summary.success += 1;
      else if (result.outcome === "failure") summary.failure += 1;
      else summary.pending += 1;
    } catch (reconcileError) {
      summary.errors += 1;
      console.error("PayU reconciliation failed", {
        attemptId: attempt.id,
        error:
          reconcileError instanceof Error
            ? reconcileError.message
            : "unknown",
      });
    }
  }

  for (const attempt of checkoutData ?? []) {
    summary.checked += 1;
    try {
      const result = await reconcileCheckoutPayuAttempt(attempt.id);
      if (result.outcome === "success") summary.success += 1;
      else if (result.outcome === "failure") summary.failure += 1;
      else summary.pending += 1;
    } catch (reconcileError) {
      summary.errors += 1;
      console.error("Checkout PayU reconciliation failed", {
        checkoutAttemptId: attempt.id,
        error:
          reconcileError instanceof Error
            ? reconcileError.message
            : "unknown",
      });
    }
  }

  await finishSystemJobRun({
    runId,
    status: summary.errors > 0 ? "failed" : "completed",
    summary,
    error: summary.errors > 0 ? `${summary.errors} reconciliation attempt(s) failed` : null,
  });
  return NextResponse.json(
    { ...summary, runId },
    {
      status: summary.errors > 0 ? 500 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
