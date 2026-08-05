import { after, NextRequest } from "next/server";
import { z } from "zod";

import {
  authenticateOrderApi,
  durableCustomOrdersAvailable,
  hasExpectedOrderOrigin,
  orderJson,
  orderJsonError,
  readOrderJson,
} from "@/lib/orders/api";
import { reconcileCustomCheckoutPayuAttempt } from "@/lib/domain/payments/processPayuEvent";
import { startSystemJobRun, finishSystemJobRun } from "@/lib/jobs/health";
import { processIntegrationJobsWithHealth } from "@/lib/jobs/run";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ checkoutAttemptId: z.string().uuid() }).strict();

export async function POST(request: NextRequest) {
  if (!durableCustomOrdersAvailable()) return orderJsonError("Custom checkout is unavailable", 503);
  if (!hasExpectedOrderOrigin(request)) return orderJsonError("Invalid request origin", 403);
  const auth = await authenticateOrderApi();
  if (!auth.ok) return auth.response;
  const body = await readOrderJson(request, 8 * 1024);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return orderJsonError("Invalid payment status request", 400);

  const admin = createAdminClient();
  const { data: attempt, error } = await admin
    .from("custom_checkout_payment_attempts")
    .select("id, status, last_reconciled_at, custom_checkout_sessions!inner(customer_user_id, final_order_number)")
    .eq("id", parsed.data.checkoutAttemptId)
    .maybeSingle();
  if (error || !attempt) return orderJsonError("Payment attempt not found", 404);
  const session = attempt.custom_checkout_sessions as unknown as {
    customer_user_id: string;
    final_order_number: string | null;
  };
  if (session.customer_user_id !== auth.user.id) return orderJsonError("Payment attempt not found", 404);

  if (
    attempt.last_reconciled_at &&
    Date.now() - new Date(attempt.last_reconciled_at).getTime() < 10_000
  ) {
    return orderJsonError("Payment status was checked recently. Try again in a few seconds", 429);
  }

  if (session.final_order_number) {
    return orderJson({
      outcome: "success",
      orderNumber: session.final_order_number,
      confirmationUrl: `/account/orders/${encodeURIComponent(session.final_order_number)}/confirmation`,
    });
  }

  const runId = await startSystemJobRun({
    jobName: "payu_reconciliation",
    triggerSource: "customer",
    triggerUserId: auth.user.id,
  });
  try {
    const result = await reconcileCustomCheckoutPayuAttempt(attempt.id);
    await finishSystemJobRun({ runId, status: "completed", summary: { checked: 1, outcome: result.outcome } });
    if (result.outcome === "success") {
      after(async () => {
        await processIntegrationJobsWithHealth({ triggerSource: "customer", triggerUserId: auth.user.id, batchSize: 10 }).catch((error) => {
          console.error("Customer-triggered integration processing failed", { error: error instanceof Error ? error.message : "unknown" });
        });
      });
    }
    return orderJson({
      outcome: result.outcome,
      orderNumber: result.orderNumber ?? null,
      confirmationUrl: result.orderNumber
        ? `/account/orders/${encodeURIComponent(result.orderNumber)}/confirmation`
        : null,
    });
  } catch (reconcileError) {
    const message = reconcileError instanceof Error ? reconcileError.message : "Payment verification failed";
    await finishSystemJobRun({ runId, status: "failed", error: message, summary: { checked: 1, errors: 1 } });
    return orderJsonError("Payment status could not be checked", 503);
  }
}
