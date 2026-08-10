import { requireStaffPermission } from "@/lib/auth/guards";
import { formatMoneyPaise } from "@/lib/orders/format";

type ProductMetric = { productId: string; productName: string; units: number; revenuePaise: number; averageLineQuantity: number };
type Metrics = {
  paidOrders: number; grossPaidPaise: number; taxableValuePaise: number; gstPaise: number;
  averageOrderValuePaise: number; unitsOrdered: number; byProduct: ProductMetric[];
  quantityBands: Record<string, number>; techniqueUsage: Record<string, number>;
  configurationMix: Record<string, number>; statusCounts: Record<string, number>;
  averageStageAgeDays: Record<string, number>; approachingExpectedDate: number; overdueOrders: number;
};

export default async function FoundryAnalyticsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const context = await requireStaffPermission("view_raw_payments");
  const query = await searchParams;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(query.to ?? "") ? query.to! : new Date().toISOString().slice(0, 10);
  const fallback = new Date();
  fallback.setUTCDate(fallback.getUTCDate() - 30);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(query.from ?? "") ? query.from! : fallback.toISOString().slice(0, 10);
  const { data, error } = await context.supabase.rpc("foundry_business_metrics", { p_from: from, p_to: to });
  if (error || !data) throw new Error("Business metrics are unavailable");
  const metrics = data as unknown as Metrics;
  const cards: Array<[string, string]> = [
    ["Verified paid orders", String(metrics.paidOrders)], ["Gross paid", formatMoneyPaise(metrics.grossPaidPaise)],
    ["Taxable value", formatMoneyPaise(metrics.taxableValuePaise)], ["GST", formatMoneyPaise(metrics.gstPaise)],
    ["Average order value", formatMoneyPaise(metrics.averageOrderValuePaise)], ["Units ordered", String(metrics.unitsOrdered)],
    ["Approaching dispatch", String(metrics.approachingExpectedDate)], ["Overdue", String(metrics.overdueOrders)],
  ];
  return <div className="space-y-8">
    <header><p className="text-xs uppercase tracking-widest text-black/40">Authoritative database metrics</p><h1 className="mt-2 text-3xl font-semibold">Business analytics</h1><p className="mt-2 text-sm text-black/55">Aggregate paid-order and production data only. No customer PII is shown here.</p></header>
    <form className="flex flex-wrap gap-3"><input type="date" name="from" defaultValue={from} className="rounded border border-black/10 bg-white p-2 text-sm"/><input type="date" name="to" defaultValue={to} className="rounded border border-black/10 bg-white p-2 text-sm"/><button className="techpack-button">Apply</button></form>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value])=><article key={label} className="techpack-surface rounded border p-5"><p className="text-xs text-black/45">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></article>)}</section>
    <section className="grid gap-5 xl:grid-cols-2">
      <MetricList title="Orders by production status" values={metrics.statusCounts}/>
      <MetricList title="Average days in current stage" values={metrics.averageStageAgeDays}/>
      <MetricList title="Quantity bands" values={metrics.quantityBands}/>
      <MetricList title="Technique usage (order lines)" values={metrics.techniqueUsage}/>
      <MetricList title="Configuration mix (order lines)" values={metrics.configurationMix}/>
      <article className="techpack-surface rounded border p-5"><h2 className="font-semibold">Product mix</h2><div className="mt-3 space-y-3">{metrics.byProduct?.map((item)=><div key={item.productId} className="border-b border-black/5 pb-2 text-sm"><div className="flex justify-between gap-4"><span>{item.productName}</span><strong>{item.units} units</strong></div><p className="text-xs text-black/45">{formatMoneyPaise(item.revenuePaise)} · average line {item.averageLineQuantity}</p></div>)}</div></article>
    </section>
  </div>;
}

function MetricList({ title, values }: { title: string; values?: Record<string, number> }) {
  return <article className="techpack-surface rounded border p-5"><h2 className="font-semibold">{title}</h2><div className="mt-3 space-y-2">{Object.entries(values ?? {}).map(([label,value])=><p key={label} className="flex justify-between text-sm"><span>{label.replaceAll("_", " ")}</span><strong>{value}</strong></p>)}</div></article>;
}
