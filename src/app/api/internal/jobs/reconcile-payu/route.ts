import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getServerEnvironment } from "@/lib/config/env";
import { durableOrdersAvailable } from "@/lib/orders/api";
import {
  reconcileCustomCheckoutPayuAttempt,
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
  if (!durableOrdersAvailable()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    return NextResponse.json(
      { error: "Reconciliation query failed" },
      { status: 500 },
    );
  }

  const customAdmin = admin as unknown as { from: (table: string) => any };
  const { data: customData, error: customError } = await customAdmin
    .from("custom_checkout_payment_attempts")
    .select("id")
    .in("status", ["initiated", "pending", "paid"])
    .lt("updated_at", staleBefore)
    .gte("created_at", createdAfter)
    .order("updated_at")
    .limit(Math.min(environment.JOB_BATCH_SIZE, 50));
  if (customError) {
    console.error("Custom checkout PayU reconciliation query failed", {
      error: customError.message,
    });
  }

  const summary = {
    checked: 0,
    success: 0,
    pending: 0,
    failure: 0,
    errors: 0,
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

  for (const attempt of customData ?? []) {
    summary.checked += 1;
    try {
      const result = await reconcileCustomCheckoutPayuAttempt(attempt.id);
      if (result.outcome === "success") summary.success += 1;
      else if (result.outcome === "failure") summary.failure += 1;
      else summary.pending += 1;
    } catch (reconcileError) {
      summary.errors += 1;
      console.error("Custom checkout PayU reconciliation failed", {
        checkoutAttemptId: attempt.id,
        error:
          reconcileError instanceof Error
            ? reconcileError.message
            : "unknown",
      });
    }
  }

  return NextResponse.json(summary, {
    headers: { "Cache-Control": "no-store" },
  });
}
