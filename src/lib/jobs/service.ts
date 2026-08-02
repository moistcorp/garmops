import "server-only";

import { getServerEnvironment } from "@/lib/config/env";
import {
  createReservationInvoice,
  markReservationInvoiceFailure,
} from "@/lib/domain/invoices/createReservationInvoice";
import { createAdminClient } from "@/lib/supabase/admin";

type IntegrationJob = Readonly<{
  id: string;
  job_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: unknown;
  attempt_count: number;
  max_attempts: number;
}>;

type JobResult = Readonly<{
  jobId: string;
  jobType: string;
  status: "completed" | "retry" | "dead";
}>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendResendEmail(input: {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
}): Promise<void> {
  const environment = getServerEnvironment();
  if (!environment.RESEND_API_KEY || !environment.RESEND_FROM_EMAIL) {
    throw Object.assign(new Error("Resend is not configured"), { retryable: false });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    headers: {
      authorization: `Bearer ${environment.RESEND_API_KEY}`,
      "content-type": "application/json",
      "idempotency-key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: environment.RESEND_FROM_EMAIL,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const error = Object.assign(
      new Error(`Resend request failed (${response.status}): ${detail.slice(0, 300)}`),
      { retryable: response.status === 408 || response.status === 429 || response.status >= 500 },
    );
    throw error;
  }
}

async function sendPaymentConfirmation(job: IntegrationJob): Promise<void> {
  const payload = record(job.payload);
  const paymentAttemptId = typeof payload.payment_attempt_id === "string"
    ? payload.payment_attempt_id
    : null;
  if (!paymentAttemptId) {
    throw Object.assign(new Error("Payment confirmation job has no payment attempt"), { retryable: false });
  }

  const admin = createAdminClient();
  const { data: attempt, error } = await admin
    .from("payment_attempts")
    .select("id, status, amount_paise, customer_email, customer_name, purpose, orders!inner(order_number, order_type, customer_user_id, organization_id)")
    .eq("id", paymentAttemptId)
    .single();
  if (error || !attempt) throw new Error(error?.message ?? "Payment attempt not found");
  if (attempt.status !== "paid") {
    throw Object.assign(new Error("Payment confirmation requires a paid attempt"), { retryable: false });
  }
  const order = attempt.orders as unknown as {
    order_number: string;
    order_type: string;
    customer_user_id: string;
    organization_id: string;
  };
  const sampleOrder = order.order_type === "sample_purchase" || attempt.purpose === "sample_full";
  const { data: invoice } = await admin
    .from("invoices")
    .select("sync_status, document_number")
    .eq("payment_attempt_id", attempt.id)
    .maybeSingle();

  const amount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(attempt.amount_paise / 100);
  const safeName = escapeHtml(attempt.customer_name);
  const safeOrder = escapeHtml(order.order_number);
  const invoiceMessage = invoice?.document_number
    ? `Your invoice <strong>${escapeHtml(invoice.document_number)}</strong> is available in your account.`
    : "Your invoice is being generated and will appear in your account shortly.";

  await sendResendEmail({
    to: attempt.customer_email,
    subject: `Payment confirmed for ${order.order_number}`,
    idempotencyKey: `garmops-payment-confirmation-${attempt.id}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#111827">
        <h1 style="font-size:24px">${sampleOrder ? "Sample payment" : "Reservation payment"} confirmed</h1>
        <p>Hi ${safeName},</p>
        <p>We verified your ${amount} ${sampleOrder ? "full sample" : "reservation"} payment for order <strong>${safeOrder}</strong>.</p>
        <p>${invoiceMessage}</p>
        <p><a href="${escapeHtml(new URL(`/account/orders/${encodeURIComponent(order.order_number)}`, getServerEnvironment().NEXT_PUBLIC_APP_URL).toString())}">View your order</a></p>
        <p style="font-size:12px;color:#6b7280">This email is generated from the verified PayU payment record. Do not reply with payment credentials.</p>
      </div>
    `,
  });
}

async function sendFinanceAlert(job: IntegrationJob, message: string): Promise<void> {
  const environment = getServerEnvironment();
  if (!environment.FINANCE_ALERT_EMAIL || !environment.RESEND_API_KEY || !environment.RESEND_FROM_EMAIL) return;
  await sendResendEmail({
    to: environment.FINANCE_ALERT_EMAIL,
    subject: `Garmops finance integration exception: ${job.job_type}`,
    idempotencyKey: `garmops-finance-alert-${job.id}-${job.attempt_count}`,
    html: `<p>Integration job <strong>${escapeHtml(job.id)}</strong> requires attention.</p><p>${escapeHtml(message)}</p>`,
  }).catch(() => undefined);
}

function retryableFrom(error: unknown): boolean {
  if (error && typeof error === "object" && "retryable" in error) {
    return Boolean((error as { retryable?: unknown }).retryable);
  }
  return true;
}

async function handleJob(job: IntegrationJob): Promise<void> {
  if (job.job_type === "create_reservation_invoice") {
    try {
      await createAdminClient()
        .from("invoices")
        .update({ attempt_count: job.attempt_count })
        .eq("id", job.aggregate_id);
      await createReservationInvoice(job.aggregate_id);
      return;
    } catch (error) {
      throw await markReservationInvoiceFailure(job.aggregate_id, error);
    }
  }
  if (job.job_type === "send_payment_confirmation") {
    await sendPaymentConfirmation(job);
    return;
  }
  throw Object.assign(new Error(`Unsupported integration job type: ${job.job_type}`), {
    retryable: false,
  });
}

export async function processIntegrationJobs(options?: {
  batchSize?: number;
  workerId?: string;
}): Promise<{
  claimed: number;
  completed: number;
  retry: number;
  dead: number;
  results: readonly JobResult[];
}> {
  const environment = getServerEnvironment();
  const admin = createAdminClient();
  const workerId = options?.workerId ?? `${environment.JOB_WORKER_ID}:${crypto.randomUUID()}`;
  const batchSize = Math.min(options?.batchSize ?? environment.JOB_BATCH_SIZE, 100);
  const { data, error } = await admin.rpc("claim_integration_jobs", {
    p_worker_id: workerId,
    p_batch_size: batchSize,
    p_lock_timeout: "15 minutes",
  });
  if (error) throw new Error(error.message);

  const jobs = (data ?? []) as IntegrationJob[];
  const results: JobResult[] = [];
  for (const job of jobs) {
    try {
      await handleJob(job);
      const { error: completeError } = await admin.rpc("complete_integration_job", {
        p_job_id: job.id,
        p_worker_id: workerId,
      });
      if (completeError) throw new Error(completeError.message);
      results.push({ jobId: job.id, jobType: job.job_type, status: "completed" });
    } catch (jobError) {
      const retryable = retryableFrom(jobError);
      const summary = jobError instanceof Error ? jobError.message : "Unknown integration failure";
      const { data: failed, error: failError } = await admin.rpc("fail_integration_job", {
        p_job_id: job.id,
        p_worker_id: workerId,
        p_error: summary.slice(0, 2000),
        p_retryable: retryable,
      });
      if (failError) {
        console.error("Integration job failure could not be persisted", {
          jobId: job.id,
          error: failError.message,
        });
        results.push({ jobId: job.id, jobType: job.job_type, status: "dead" });
        continue;
      }
      const status = failed?.status === "retry" ? "retry" : "dead";
      results.push({ jobId: job.id, jobType: job.job_type, status });
      if (status === "dead") await sendFinanceAlert(job, summary);
    }
  }

  return {
    claimed: jobs.length,
    completed: results.filter((entry) => entry.status === "completed").length,
    retry: results.filter((entry) => entry.status === "retry").length,
    dead: results.filter((entry) => entry.status === "dead").length,
    results: Object.freeze(results),
  };
}
