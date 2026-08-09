import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.generated";

export type SystemJobName = "integration_jobs" | "payu_reconciliation";
export type SystemJobTrigger = "cron" | "staff" | "customer" | "system";

export async function startSystemJobRun(input: {
  jobName: SystemJobName;
  triggerSource?: SystemJobTrigger;
  triggerUserId?: string | null;
}): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("system_job_runs")
    .insert({
      job_name: input.jobName,
      trigger_source: input.triggerSource ?? "cron",
      trigger_user_id: input.triggerUserId ?? null,
      status: "running",
    })
    .select("id")
    .single();
  if (error) {
    console.error("System job run could not be started", {
      jobName: input.jobName,
      error: error.message,
    });
    return null;
  }
  return data.id;
}

export async function finishSystemJobRun(input: {
  runId: string | null;
  status: "completed" | "failed";
  summary?: Record<string, unknown>;
  error?: string | null;
}): Promise<void> {
  if (!input.runId) return;
  const { error } = await createAdminClient()
    .from("system_job_runs")
    .update({
      status: input.status,
      summary: (input.summary ?? {}) as Json,
      error_message: input.error ? input.error.slice(0, 4000) : null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.runId);
  if (error) {
    console.error("System job run could not be completed", {
      runId: input.runId,
      error: error.message,
    });
  }
}

export async function recordPaymentReconciliation(input: {
  attemptId: string;
  customCheckout: boolean;
  error?: string | null;
}): Promise<void> {
  const { error } = await createAdminClient().rpc(
    "record_payment_reconciliation_attempt",
    {
      p_attempt_id: input.attemptId,
      p_custom_checkout: input.customCheckout,
      p_error: input.error ?? undefined,
    },
  );
  if (error) {
    console.error("Payment reconciliation metadata could not be recorded", {
      attemptId: input.attemptId,
      customCheckout: input.customCheckout,
      error: error.message,
    });
  }
}
