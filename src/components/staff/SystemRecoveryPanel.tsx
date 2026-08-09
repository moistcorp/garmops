import { AlertTriangle, CheckCircle2, Clock3, RefreshCw } from "lucide-react";

import { requireStaffPermission } from "@/lib/auth/guards";
import { formatMoneyPaise, formatOrderTimestamp } from "@/lib/orders/format";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ProcessJobsNowForm,
  RecheckPaymentForm,
  RetryIntegrationJobForm,
} from "@/components/staff/SystemRecoveryForms";

type JobRun = {
  id: string;
  job_name: string;
  status: string;
  trigger_source: string;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  summary: Record<string, unknown>;
};
type PendingAttempt = {
  id: string;
  amount_paise: number;
  status: string;
  customer_email: string;
  provider_merchant_txn_id: string;
  reconciliation_attempts: number;
  last_reconciled_at: string | null;
  last_reconciliation_error: string | null;
  updated_at: string;
  custom_checkout_sessions: {
    cart_id: string;
    status: string;
    final_order_number: string | null;
  };
};
type FailedJob = {
  id: string;
  job_type: string;
  status: string;
  attempts: number;
  last_error: string | null;
  updated_at: string;
  payload: Record<string, unknown>;
};

function isHealthy(run: JobRun | undefined, maximumAgeMinutes: number): boolean {
  return Boolean(
    run &&
    run.status === "completed" &&
    Date.now() - new Date(run.started_at).getTime() <= maximumAgeMinutes * 60_000,
  );
}

export default async function SystemRecoveryPanel() {
  const context = await requireStaffPermission("view_all_orders");
  const admin = createAdminClient();
  // This is request-time server data, not client render state.
  // eslint-disable-next-line react-hooks/purity
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [runsResult, pendingResult, failedResult, queuedResult] = await Promise.all([
    admin.from("system_job_runs").select("id, job_name, status, trigger_source, started_at, completed_at, error_message, summary").order("started_at", { ascending: false }).limit(20),
    admin.from("custom_checkout_payment_attempts")
      .select("id, amount_paise, status, customer_email, provider_merchant_txn_id, reconciliation_attempts, last_reconciled_at, last_reconciliation_error, updated_at, custom_checkout_sessions!inner(cart_id, status, final_order_number)")
      .in("status", ["initiated", "pending"])
      .gte("created_at", sevenDaysAgo)
      .order("updated_at")
      .limit(20),
    admin.from("integration_jobs")
      .select("id, job_type, status, attempts, last_error, updated_at, payload")
      .in("status", ["retryable_failure", "permanent_failure"])
      .order("updated_at", { ascending: false })
      .limit(20),
    admin.from("integration_jobs").select("id", { count: "exact", head: true }).in("status", ["queued", "retryable_failure"]),
  ]);

  const runs = (runsResult.data ?? []) as unknown as JobRun[];
  const pending = ((pendingResult.data ?? []) as unknown as PendingAttempt[]).filter(
    (attempt) => !attempt.custom_checkout_sessions.final_order_number,
  );
  const failedJobs = (failedResult.data ?? []) as unknown as FailedJob[];
  const latestJobs = runs.find(
    (run) => run.job_name === "integration_jobs" && run.trigger_source === "cron",
  );
  const latestPayu = runs.find(
    (run) => run.job_name === "payu_reconciliation" && run.trigger_source === "cron",
  );
  const jobsHealthy = isHealthy(latestJobs, 15) && failedJobs.length === 0;
  const payuHealthy = isHealthy(latestPayu, 30);

  return <section className="techpack-surface rounded-[4px] border p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">Payments & integrations</p><h2 className="mt-2 text-lg font-semibold">Recovery centre</h2><p className="mt-1 text-xs text-black/45">Cron health, pending PayU attempts, invoices and email jobs.</p></div>
      <ProcessJobsNowForm />
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {[{ label: "Scheduled invoice / email processor", run: latestJobs, healthy: jobsHealthy }, { label: "Scheduled PayU reconciliation", run: latestPayu, healthy: payuHealthy }].map((item) => <div key={item.label} className={`rounded border p-4 ${item.healthy ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex items-center gap-2">{item.healthy ? <CheckCircle2 size={16} className="text-emerald-700" /> : <AlertTriangle size={16} className="text-amber-700" />}<p className="text-sm font-semibold">{item.label}</p></div>
        <p className="mt-2 text-xs text-black/55">{item.run ? `${item.run.status} · ${formatOrderTimestamp(item.run.started_at)} · ${item.run.trigger_source}` : "No recorded run after migration"}</p>
        {item.run?.error_message ? <p className="mt-1 text-xs text-red-700">{item.run.error_message}</p> : null}
      </div>)}
    </div>

    <div className="mt-6 grid gap-5 xl:grid-cols-2">
      <div><div className="flex items-center gap-2"><RefreshCw size={16} className="text-[var(--color-accent)]" /><h3 className="text-sm font-semibold">Pending PayU attempts</h3></div><div className="mt-3 space-y-3">{pending.length ? pending.map((attempt) => <div key={attempt.id} className="rounded border border-black/8 p-3"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-sm font-semibold">{attempt.customer_email}</p><p className="mt-1 font-mono text-[10px] text-black/40">{context.role === "founder" ? attempt.provider_merchant_txn_id : "Provider reference restricted"}</p><p className="mt-1 text-xs text-black/50">{formatMoneyPaise(attempt.amount_paise)} · {attempt.status} · updated {formatOrderTimestamp(attempt.updated_at)}</p><p className="mt-1 text-[10px] text-black/40">Rechecks: {attempt.reconciliation_attempts}{attempt.last_reconciled_at ? ` · last ${formatOrderTimestamp(attempt.last_reconciled_at)}` : ""}</p>{attempt.last_reconciliation_error ? <p className="mt-1 text-xs text-red-700">{attempt.last_reconciliation_error}</p> : null}</div><RecheckPaymentForm attemptId={attempt.id} /></div></div>) : <p className="rounded bg-emerald-50 p-3 text-xs text-emerald-800">No unresolved PayU attempts from the last seven days.</p>}</div></div>

      <div><div className="flex items-center gap-2"><Clock3 size={16} className="text-[var(--color-accent)]" /><h3 className="text-sm font-semibold">Failed integration jobs</h3><span className="text-xs text-black/40">{queuedResult.count ?? 0} ready</span></div><div className="mt-3 space-y-3">{failedJobs.length ? failedJobs.map((job) => <div key={job.id} className="rounded border border-black/8 p-3"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-sm font-semibold">{job.job_type.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-black/50">{job.status.replaceAll("_", " ")} · attempt {job.attempts} · {formatOrderTimestamp(job.updated_at)}</p>{job.last_error ? <p className="mt-1 max-w-xl text-xs text-red-700">{job.last_error}</p> : null}</div><RetryIntegrationJobForm jobId={job.id} /></div></div>) : <p className="rounded bg-emerald-50 p-3 text-xs text-emerald-800">No failed invoice or email jobs.</p>}</div></div>
    </div>
  </section>;
}
