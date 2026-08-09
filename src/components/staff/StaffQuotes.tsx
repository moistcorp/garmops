import TechpackPageHeader from "@/components/portal/TechpackPageHeader";
import OfflinePaymentForm from "@/components/staff/OfflinePaymentForm";
import StaffQuoteForm from "@/components/staff/StaffQuoteForm";
import { requireStaffPermission } from "@/lib/auth/guards";
import { formatMoneyPaise, formatOrderTimestamp } from "@/lib/orders/format";
import type { Tables } from "@/types/database.generated";
type QuoteRow = Pick<Tables<"staff_quotes">, "id" | "quote_number" | "customer_email" | "customer_name" | "subtotal_paise" | "tax_paise" | "total_paise" | "status" | "expires_at" | "final_order_id" | "created_at">;

export default async function StaffQuotes() {
  const context = await requireStaffPermission("create_staff_quote");
  const { data, error } = await context.supabase.from("staff_quotes").select("id, quote_number, customer_email, customer_name, subtotal_paise, tax_paise, total_paise, status, expires_at, final_order_id, created_at").order("created_at", { ascending: false }).limit(100);
  const quotes = (data ?? []) as unknown as QuoteRow[];
  return <div className="space-y-5">
    <TechpackPageHeader eyebrow="Foundry" reference="Customer-assisted sales" title="Staff quotations" description="Create a server-priced full-payment quotation. The customer verifies the quoted email and pays once through PayU; shipping is free." />
    {error ? <div className="techpack-notice p-5" data-tone="error">{error.message}</div> : null}
    <div className="grid gap-5 2xl:grid-cols-[0.95fr_1.05fr]">
      <section className="techpack-surface rounded border p-5"><h2 className="font-semibold">Create quotation</h2><p className="mt-1 text-xs text-black/45">Operations and Founder may create quotes. Neither role can type or override the merchandise price.</p><div className="mt-5"><StaffQuoteForm /></div></section>
      <section className="techpack-surface rounded border p-5"><h2 className="font-semibold">Recent quotations</h2><div className="mt-4 space-y-3">{quotes.length ? quotes.map((quote) => <article key={quote.id} className="rounded border border-black/8 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono font-semibold">{quote.quote_number}</p><p className="mt-1 text-sm">{quote.customer_name}</p><p className="text-xs text-black/45">{quote.customer_email} · {formatOrderTimestamp(quote.created_at)}</p></div><div className="text-right"><span className="techpack-stamp">{String(quote.status).replaceAll("_", " ")}</span><p className="mt-2 font-semibold">{formatMoneyPaise(quote.total_paise)}</p><p className="text-[11px] text-black/40">GST {formatMoneyPaise(quote.tax_paise)}</p></div></div><p className="mt-3 text-[11px] text-black/45">Valid until {formatOrderTimestamp(quote.expires_at)}</p>{context.role === "founder" && quote.status === "sent" ? <OfflinePaymentForm quoteId={quote.id} quoteNumber={quote.quote_number} /> : null}</article>) : <p className="py-12 text-center text-sm text-black/45">No staff quotations yet.</p>}</div></section>
    </div>
  </div>;
}
