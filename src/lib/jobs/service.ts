import "server-only";

import { getServerEnvironment } from "@/lib/config/env";
import {
  createTaxInvoiceForOrder,
  markTaxInvoiceFailure,
} from "@/lib/domain/invoices/createTaxInvoice";
import {
  EMAIL_THEME,
  escapeEmailHtml,
  renderBrandedEmail,
} from "@/lib/email/brand";
import { createAdminClient } from "@/lib/supabase/admin";

type IntegrationJob = Readonly<{
  id: string;
  job_type: string;
  payload: unknown;
  attempts: number;
}>;

type JobResult = Readonly<{
  jobId: string;
  jobType: string;
  status: "completed" | "retry" | "dead";
}>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
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
    throw Object.assign(
      new Error(`Resend request failed (${response.status}): ${detail.slice(0, 300)}`),
      { retryable: response.status === 408 || response.status === 429 || response.status >= 500 },
    );
  }
}

async function sendOrderConfirmation(job: IntegrationJob): Promise<void> {
  const payload = record(job.payload);
  const orderId = typeof payload.orderId === "string" ? payload.orderId : null;
  if (!orderId) throw Object.assign(new Error("Order confirmation job has no order"), { retryable: false });
  const admin = createAdminClient();
  const [
    { data: order, error: orderError },
    { data: payment, error: paymentError },
    { data: invoice },
    { data: orderItems, error: itemsError },
  ] = await Promise.all([
    admin.from("orders")
      .select("id, order_number, order_type, customer_snapshot, total_paise")
      .eq("id", orderId)
      .single(),
    admin.from("payment_attempts")
      .select("id, status, amount_paise, customer_email, customer_name")
      .eq("order_id", orderId)
      .eq("purpose", "order_full")
      .eq("status", "paid")
      .maybeSingle(),
    admin.from("invoices")
      .select("invoice_number, status")
      .eq("order_id", orderId)
      .eq("kind", "tax_invoice")
      .maybeSingle(),
    admin.from("order_items")
      .select("line_number, product_name, quantity")
      .eq("order_id", orderId)
      .order("line_number"),
  ]);
  if (orderError || !order) throw new Error(orderError?.message ?? "Order not found");
  if (paymentError || !payment) throw new Error(paymentError?.message ?? "Verified payment not found");
  if (itemsError) throw new Error(itemsError.message);
  const sampleOrder = order.order_type === "sample_purchase";
  const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(payment.amount_paise) / 100);
  const orderUrl = new URL(
    `/account/orders/${encodeURIComponent(order.order_number)}`,
    getServerEnvironment().NEXT_PUBLIC_CUSTOMER_APP_URL,
  ).toString();
  const invoiceMessage = invoice?.invoice_number
    ? `Tax invoice <strong>${escapeEmailHtml(invoice.invoice_number, 100)}</strong> is available in your account.`
    : "Your GST tax invoice is being generated and will appear in your account shortly.";
  const itemRows = (orderItems ?? []).map((item) =>
    `<li style="margin:0 0 6px;"><strong>Line ${Number(item.line_number)}: ${escapeEmailHtml(item.product_name, 160)}</strong> · ${Number(item.quantity).toLocaleString("en-IN")} units</li>`,
  ).join("");
  const itemSummary = itemRows
    ? `<div style="margin:16px 0;padding:14px 16px;border:1px solid ${EMAIL_THEME.line};border-radius:4px;"><p style="margin:0 0 8px;font-weight:600;color:${EMAIL_THEME.ink};">${(orderItems ?? []).length.toLocaleString("en-IN")} configured product${(orderItems ?? []).length === 1 ? "" : "s"}</p><ul style="margin:0;padding-left:18px;color:${EMAIL_THEME.muted};">${itemRows}</ul></div>`
    : "";
  await sendResendEmail({
    to: payment.customer_email,
    subject: `Order ${order.order_number} confirmed`,
    idempotencyKey: `garmops-order-confirmation-${order.id}`,
    html: renderBrandedEmail({
      preheader: `Full payment confirmed for order ${order.order_number}.`,
      eyebrow: sampleOrder ? "Catalogue samples" : "Custom order",
      title: "Payment confirmed and order received",
      statusLabel: "Full payment verified",
      statusTone: "success",
      action: { label: "View order", url: orderUrl },
      footerNote: "Shipping is quoted separately by the Garmops operations team through a secure PayU payment link.",
      bodyHtml: `
        <p style="margin: 0 0 10px;">Hi ${escapeEmailHtml(payment.customer_name, 160)},</p>
        <p style="margin: 0 0 16px; color: ${EMAIL_THEME.muted};">We verified your full payment of <strong style="color: ${EMAIL_THEME.ink};">${escapeEmailHtml(amount, 100)}</strong> for order <strong style="color: ${EMAIL_THEME.ink};">${escapeEmailHtml(order.order_number, 100)}</strong>.</p>
        ${itemSummary}
        <div style="padding: 14px 16px; border: 1px solid ${EMAIL_THEME.line}; border-left: 3px solid ${EMAIL_THEME.accent}; border-radius: 4px; background: ${EMAIL_THEME.accentSoft}; color: ${EMAIL_THEME.accentDark};">${invoiceMessage}</div>
      `,
    }),
  });
}

async function sendFinanceAlert(job: IntegrationJob, message: string): Promise<void> {
  const environment = getServerEnvironment();
  if (!environment.FINANCE_ALERT_EMAIL || !environment.RESEND_API_KEY || !environment.RESEND_FROM_EMAIL) return;
  await sendResendEmail({
    to: environment.FINANCE_ALERT_EMAIL,
    subject: `Garmops finance exception: ${job.job_type}`,
    idempotencyKey: `garmops-finance-alert-${job.id}-${job.attempts}`,
    html: renderBrandedEmail({
      preheader: `Finance exception for ${job.job_type}.`,
      eyebrow: "Finance / integration alert",
      title: "Manual review required",
      statusLabel: "Exception",
      statusTone: "danger",
      bodyHtml: `<p style="margin:0;color:${EMAIL_THEME.muted};">Job <strong style="color:${EMAIL_THEME.ink};">${escapeEmailHtml(job.id, 100)}</strong>: ${escapeEmailHtml(message, 1000)}</p>`,
    }),
  }).catch(() => undefined);
}

function retryableFrom(error: unknown): boolean {
  if (error && typeof error === "object" && "retryable" in error) {
    return Boolean((error as { retryable?: unknown }).retryable);
  }
  return true;
}

async function handleJob(job: IntegrationJob): Promise<void> {
  const payload = record(job.payload);
  if (job.job_type === "generate_tax_invoice") {
    const orderId = typeof payload.orderId === "string" ? payload.orderId : null;
    if (!orderId) throw Object.assign(new Error("Invoice job has no order"), { retryable: false });
    try {
      await createTaxInvoiceForOrder(orderId);
    } catch (error) {
      throw await markTaxInvoiceFailure(orderId, error);
    }
    return;
  }
  if (job.job_type === "send_order_confirmation") {
    await sendOrderConfirmation(job);
    return;
  }
  if (job.job_type === "finance_duplicate_payment") {
    await sendFinanceAlert(job, "PayU verified more than one successful attempt for the same checkout. Review and refund the duplicate manually.");
    return;
  }
  if (job.job_type === "send_staff_quote") {
    // Quote email delivery is implemented by the staff quote route, which stores
    // the one-time token URL in the job payload. Keeping it in the same queue
    // makes retries idempotent and observable.
    const to = typeof payload.customerEmail === "string" ? payload.customerEmail : null;
    const quoteNumber = typeof payload.quoteNumber === "string" ? payload.quoteNumber : null;
    const paymentUrl = typeof payload.paymentUrl === "string" ? payload.paymentUrl : null;
    if (!to || !quoteNumber || !paymentUrl) throw Object.assign(new Error("Staff quote job is incomplete"), { retryable: false });
    await sendResendEmail({
      to,
      subject: `Garmops quotation ${quoteNumber}`,
      idempotencyKey: `garmops-staff-quote-${quoteNumber}`,
      html: renderBrandedEmail({
        preheader: `Review and pay quotation ${quoteNumber}.`,
        eyebrow: "Quotation / payment link",
        title: "Your Garmops quotation is ready",
        statusLabel: "Secure link",
        statusTone: "accent",
        action: { label: "Review and pay", url: paymentUrl },
        bodyHtml: `<p style="margin:0;color:${EMAIL_THEME.muted};">This link is tied to the quoted email address and expires automatically. The order is created only after full payment is verified.</p>`,
      }),
    });
    return;
  }
  throw Object.assign(new Error(`Unsupported integration job type: ${job.job_type}`), { retryable: false });
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
    p_limit: batchSize,
  });
  if (error) throw new Error(error.message);

  const jobs = (data ?? []) as IntegrationJob[];
  const results: JobResult[] = [];
  for (const job of jobs) {
    try {
      await handleJob(job);
      const { data: completed, error: completeError } = await admin.rpc("complete_integration_job", {
        p_job_id: job.id,
        p_worker_id: workerId,
      });
      if (completeError || !completed) throw new Error(completeError?.message ?? "Job completion lock was lost");
      results.push({ jobId: job.id, jobType: job.job_type, status: "completed" });
    } catch (jobError) {
      const retryable = retryableFrom(jobError);
      const summary = jobError instanceof Error ? jobError.message : "Unknown integration failure";
      const delayMinutes = Math.min(60, Math.max(5, 2 ** Math.min(job.attempts, 5)));
      const { data: failed, error: failError } = await admin.rpc("fail_integration_job", {
        p_job_id: job.id,
        p_worker_id: workerId,
        p_error: summary.slice(0, 4000),
        p_retry_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
        p_permanent: !retryable || job.attempts >= 8,
      });
      if (failError || !failed) {
        console.error("Integration job failure could not be persisted", { jobId: job.id, error: failError?.message });
        results.push({ jobId: job.id, jobType: job.job_type, status: "dead" });
        continue;
      }
      const status = !retryable || job.attempts >= 8 ? "dead" : "retry";
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
