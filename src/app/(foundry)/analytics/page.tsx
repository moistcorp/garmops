import { requireStaffPermission } from "@/lib/auth/guards";
import { formatMoneyPaise } from "@/lib/orders/format";
import { addBlackoutDateAction, addCapacityRuleAction, addLeadTimeRuleAction, saveWorkingDaysAction } from "./actions";

type ProductMetric = { productId: string; productName: string; units: number; revenuePaise: number; averageLineQuantity: number };
type Metrics = {
  paidOrders: number; grossPaidPaise: number; taxableValuePaise: number; gstPaise: number;
  averageOrderValuePaise: number; unitsOrdered: number; byProduct: ProductMetric[];
  quantityBands: Record<string, number>; techniqueUsage: Record<string, number>;
  configurationMix: Record<string, number>; statusCounts: Record<string, number>;
  averageStageAgeDays: Record<string, number>; approachingExpectedDate: number; overdueOrders: number;
};

const techniques = <><option value="">All techniques</option><option value="screen_print">Screen Print</option><option value="dtf">DTF</option><option value="reflective_print">Reflective Print</option></>;
const field = "rounded border border-black/10 bg-white p-2 text-sm";

export default async function FoundryAnalyticsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const context = await requireStaffPermission("view_raw_payments");
  const query = await searchParams;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(query.to ?? "") ? query.to! : new Date().toISOString().slice(0, 10);
  const fallback = new Date(); fallback.setUTCDate(fallback.getUTCDate() - 30);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(query.from ?? "") ? query.from! : fallback.toISOString().slice(0, 10);
  const [{ data, error }, working, blackouts, capacity, lead] = await Promise.all([
    context.supabase.rpc("foundry_business_metrics", { p_from: from, p_to: to }),
    context.supabase.from("production_working_days").select("weekday,is_working").order("weekday"),
    context.supabase.from("production_blackout_dates").select("date,note,active").order("date", { ascending: false }).limit(12),
    context.supabase.from("production_capacity_rules").select("id,effective_from,daily_unit_capacity,product_category,technique,active").order("effective_from", { ascending: false }).limit(12),
    context.supabase.from("production_lead_time_rules").select("id,product_category,technique,custom_dye_extra_days,setup_buffer_days,qc_dispatch_buffer_days,rush_eligible,active").order("created_at", { ascending: false }).limit(12),
  ]);
  if (error || !data) throw new Error("Business metrics are unavailable");
  const metrics = data as unknown as Metrics;
  const cards: Array<[string, string]> = [
    ["Verified paid orders", String(metrics.paidOrders)], ["Gross paid", formatMoneyPaise(metrics.grossPaidPaise)],
    ["Taxable value", formatMoneyPaise(metrics.taxableValuePaise)], ["GST", formatMoneyPaise(metrics.gstPaise)],
    ["Average order value", formatMoneyPaise(metrics.averageOrderValuePaise)], ["Units ordered", String(metrics.unitsOrdered)],
    ["Approaching dispatch", String(metrics.approachingExpectedDate)], ["Overdue", String(metrics.overdueOrders)],
  ];
  const workingSet = new Set(working.data?.filter((row) => row.is_working).map((row) => row.weekday));
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return <div className="space-y-8">
    <header><p className="text-xs uppercase tracking-widest text-black/40">Authoritative database metrics</p><h1 className="mt-2 text-3xl font-semibold">Business analytics</h1><p className="mt-2 text-sm text-black/55">Aggregate paid-order and production data only. No customer PII is shown here.</p></header>
    <form className="flex flex-wrap gap-3"><input type="date" name="from" defaultValue={from} className={field}/><input type="date" name="to" defaultValue={to} className={field}/><button className="techpack-button">Apply</button></form>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value])=><article key={label} className="techpack-surface rounded border p-5"><p className="text-xs text-black/45">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></article>)}</section>
    <section className="grid gap-5 xl:grid-cols-2">
      <MetricList title="Orders by production status" values={metrics.statusCounts}/>
      <MetricList title="Average days in current stage" values={metrics.averageStageAgeDays}/>
      <MetricList title="Quantity bands" values={metrics.quantityBands}/>
      <MetricList title="Technique usage (order lines)" values={metrics.techniqueUsage}/>
      <MetricList title="Configuration mix (order lines)" values={metrics.configurationMix}/>
      <article className="techpack-surface rounded border p-5"><h2 className="font-semibold">Product mix</h2><div className="mt-3 space-y-3">{metrics.byProduct?.map((item)=><div key={item.productId} className="border-b border-black/5 pb-2 text-sm"><div className="flex justify-between gap-4"><span>{item.productName}</span><strong>{item.units} units</strong></div><p className="text-xs text-black/45">{formatMoneyPaise(item.revenuePaise)} · average line {item.averageLineQuantity}</p></div>)}</div></article>
    </section>
    <section className="space-y-5"><header><h2 className="text-2xl font-semibold">Production settings</h2><p className="text-sm text-black/55">Founder-managed operational inputs. Empty configuration keeps the conservative 35/18 working-day fallback.</p></header>
      <div className="grid gap-5 xl:grid-cols-2">
        <form action={saveWorkingDaysAction} className="techpack-surface rounded border p-5"><h3 className="font-semibold">Working days</h3><div className="mt-3 grid grid-cols-2 gap-2">{weekdays.map((day,index)=><label key={day} className="text-sm"><input type="checkbox" name="weekday" value={index} defaultChecked={workingSet.has(index)} className="mr-2"/>{day}</label>)}</div><button className="techpack-button mt-4">Save working days</button></form>
        <form action={addBlackoutDateAction} className="techpack-surface rounded border p-5"><h3 className="font-semibold">Blackout date</h3><div className="mt-3 flex flex-col gap-2"><input required type="date" name="date" className={field}/><input name="note" maxLength={300} placeholder="Reason (optional)" className={field}/><button className="techpack-button">Add blackout</button></div><div className="mt-3 text-xs text-black/50">{blackouts.data?.map((row)=><p key={row.date}>{row.date} · {row.note || "No note"}{row.active ? "" : " · inactive"}</p>)}</div></form>
        <form action={addCapacityRuleAction} className="techpack-surface rounded border p-5"><h3 className="font-semibold">Capacity rule</h3><div className="mt-3 grid gap-2"><input required type="date" name="effectiveFrom" className={field}/><input required type="number" min="1" name="dailyUnitCapacity" placeholder="Daily unit capacity" className={field}/><input name="productCategory" placeholder="Product category (optional)" className={field}/><select name="technique" className={field}>{techniques}</select><button className="techpack-button">Add capacity rule</button></div><div className="mt-3 text-xs text-black/50">{capacity.data?.map((row)=><p key={row.id}>{row.effective_from} · {row.daily_unit_capacity}/day · {row.product_category || "all products"} · {row.technique || "all techniques"}</p>)}</div></form>
        <form action={addLeadTimeRuleAction} className="techpack-surface rounded border p-5"><h3 className="font-semibold">Lead-time rule</h3><div className="mt-3 grid gap-2"><input name="productCategory" placeholder="Product category (optional)" className={field}/><select name="technique" className={field}>{techniques}</select><input required type="number" min="0" defaultValue="0" name="customDyeExtraDays" placeholder="Custom dye extra days" className={field}/><input required type="number" min="0" defaultValue="0" name="setupBufferDays" placeholder="Setup buffer days" className={field}/><input required type="number" min="0" defaultValue="0" name="qcDispatchBufferDays" placeholder="QC / dispatch buffer days" className={field}/><label className="text-sm"><input type="checkbox" name="rushEligible" className="mr-2"/>Rush eligible</label><button className="techpack-button">Add lead-time rule</button></div><div className="mt-3 text-xs text-black/50">{lead.data?.map((row)=><p key={row.id}>{row.product_category || "all products"} · {row.technique || "all techniques"} · +{row.custom_dye_extra_days + row.setup_buffer_days + row.qc_dispatch_buffer_days} days · rush {row.rush_eligible ? "yes" : "no"}</p>)}</div></form>
      </div>
    </section>
  </div>;
}

function MetricList({ title, values }: { title: string; values?: Record<string, number> }) {
  return <article className="techpack-surface rounded border p-5"><h2 className="font-semibold">{title}</h2><div className="mt-3 space-y-2">{Object.entries(values ?? {}).map(([label,value])=><p key={label} className="flex justify-between text-sm"><span>{label.replaceAll("_", " ")}</span><strong>{value}</strong></p>)}</div></article>;
}
