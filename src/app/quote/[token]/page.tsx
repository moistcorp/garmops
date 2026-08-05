import { notFound, redirect } from "next/navigation";
import { Clock3, ReceiptIndianRupee, ShieldCheck } from "lucide-react";

import PendingCheckoutRecovery from "@/components/payment/PendingCheckoutRecovery";
import StaffQuoteCheckout from "@/components/quotes/StaffQuoteCheckout";
import { requireCustomer } from "@/lib/auth/guards";
import { formatMoneyPaise } from "@/lib/orders/format";
import { formatGstRate } from "@/lib/tax";
import { getStaffQuoteForCustomer } from "@/lib/quotes/service";

function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export default async function StaffQuotePaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ payment?: string; checkoutAttempt?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const paymentOutcome =
    query.payment === "pending" || query.payment === "failure"
      ? query.payment
      : undefined;
  const checkoutAttemptId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    query.checkoutAttempt ?? "",
  )
    ? query.checkoutAttempt
    : undefined;
  const { user } = await requireCustomer(`/quote/${token}`);
  const quote = await getStaffQuoteForCustomer(token, user);
  if (!quote) notFound();
  if (quote.status === "paid" && quote.finalOrderId) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data } = await createAdminClient().from("orders").select("order_number").eq("id", quote.finalOrderId).maybeSingle();
    if (data?.order_number) redirect(`/account/orders/${data.order_number}`);
  }
  const config = record(quote.configuration);
  const design = record(config.design);
  const build = record(design.configuration);
  const colour = record(build.colour);
  const items = Array.isArray(quote.pricing.items) ? quote.pricing.items as Array<Record<string, unknown>> : [];
  const item = items[0] ?? {};
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-12 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="techpack-surface rounded border p-6 sm:p-8">
          <span className="techpack-stamp" data-tone="accent">Staff quotation</span>
          <h1 className="mt-4 text-2xl font-semibold">{quote.quoteNumber}</h1>
          <p className="mt-2 text-sm text-black/50">Prepared for {quote.customerName} · {quote.customerEmail}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded border border-black/8 bg-white p-4"><p className="text-xs uppercase tracking-wide text-black/40">Product</p><p className="mt-1 font-semibold">{String(item.product_name ?? design.configId ?? "Custom garment")}</p><p className="mt-1 text-xs text-black/45">{String(colour.name ?? "Colour in specification")} · {String(item.quantity ?? "—")} units</p></div>
            <div className="rounded border border-black/8 bg-white p-4"><p className="text-xs uppercase tracking-wide text-black/40">Valid until</p><p className="mt-1 font-semibold">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(quote.expiresAt))}</p></div>
          </div>
          <div className="mt-6 border-t border-black/10 pt-5 text-sm">
            <div className="flex justify-between"><span>Merchandise subtotal</span><strong>{formatMoneyPaise(quote.subtotalPaise)}</strong></div>
            <div className="mt-2 flex justify-between"><span>GST at {formatGstRate()}</span><strong>{formatMoneyPaise(quote.taxPaise)}</strong></div>
            <div className="mt-4 flex justify-between border-t border-black/10 pt-4 text-lg"><span>Quoted total</span><strong>{formatMoneyPaise(quote.totalPaise)}</strong></div>
            <p className="mt-3 text-xs text-black/45">A valid Founder-created discount code may reduce the checkout total. The server recalculates GST after discount.</p>
          </div>
          <div className="mt-6 grid gap-3 text-xs text-black/55 sm:grid-cols-3"><div className="flex gap-2"><ShieldCheck size={16} className="shrink-0 text-[var(--color-accent)]" />Email-bound secure link</div><div className="flex gap-2"><ReceiptIndianRupee size={16} className="shrink-0 text-[var(--color-accent)]" />Full payment including GST</div><div className="flex gap-2"><Clock3 size={16} className="shrink-0 text-[var(--color-accent)]" />Order created after verification</div></div>
        </section>
        <aside className="techpack-surface h-fit rounded border p-6">
          <h2 className="font-semibold">Review and pay</h2>
          <p className="mt-2 text-xs leading-relaxed text-black/50">You are signed in with the quoted customer email. Complete full payment securely through PayU.</p>
          {paymentOutcome ? (
            <div className="mt-5">
              <PendingCheckoutRecovery
                outcome={paymentOutcome}
                checkoutAttemptId={checkoutAttemptId}
                retryHref={`/quote/${encodeURIComponent(token)}`}
                retryLabel="Return to this quotation"
              />
            </div>
          ) : null}
          {paymentOutcome !== "pending" ? (
            <div className="mt-5">
              <StaffQuoteCheckout token={token} totalPaise={quote.totalPaise} />
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
