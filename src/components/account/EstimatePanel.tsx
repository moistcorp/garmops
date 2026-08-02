"use client";

import { ArrowRight, Download, LoaderCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { deriveEstimateStatus, estimateStatusLabel } from "@/lib/estimates/presentation";
import { formatMoneyPaise, formatOrderTimestamp } from "@/lib/orders/format";
import type { EstimateRecord } from "@/lib/pricing/types";

export default function EstimatePanel({ designId, currentRevision, initialEstimates }: { designId: string; currentRevision: number; initialEstimates: EstimateRecord[] }) {
  const [estimates, setEstimates] = useState(initialEstimates);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const latest = estimates[0];
  const latestStatus = latest ? deriveEstimateStatus(latest) : null;
  const isStale = Boolean(latest && latestStatus === "active" && latest.design_revision !== currentRevision);
  const visibleEstimate = latest && latestStatus !== "superseded" && latestStatus !== "cancelled" ? latest : undefined;
  const actionLabel = !latest ? "Generate estimate" : isStale || latestStatus === "expired" ? "Update estimate" : "Refresh estimate";

  async function generate() {
    setLoading(true); setMessage(null);
    try {
      const response = await fetch(`/api/designs/${encodeURIComponent(designId)}/estimates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: currentRevision, clientOperationId: crypto.randomUUID() }) });
      const body = await response.json().catch(() => ({})) as { estimate?: EstimateRecord; error?: string };
      if (response.status === 409) setMessage("This design changed. Refresh the page to generate an estimate for the latest version.");
      else if (!response.ok || !body.estimate) setMessage(body.error ?? "We couldn’t generate the estimate. Your design is safe. Try again in a moment.");
      else setEstimates((current) => [body.estimate!, ...current.filter((item) => item.id !== body.estimate!.id)]);
    } catch { setMessage("We couldn’t generate the estimate. Your design is safe. Try again in a moment."); }
    finally { setLoading(false); }
  }

  return <section className="rounded-[4px] border border-[#1D49B4]/15 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="estimate-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-[#1D49B4]">Estimate</p><h2 id="estimate-title" className="mt-1 text-xl font-semibold">{latest ? (isStale ? "Update estimate" : estimateStatusLabel(latestStatus!)) : "Estimate not generated"}</h2></div>{latest ? <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${isStale || latestStatus === "expired" ? "bg-amber-100 text-amber-900" : latestStatus === "converted" ? "bg-emerald-100 text-emerald-900" : "bg-[#E9F0FF] text-[#173A91]"}`}>{isStale ? "Update estimate" : estimateStatusLabel(latestStatus!)}</span> : null}</div>
    {latest && (isStale || latestStatus === "expired") ? <p className="mt-3 text-sm text-black/55">{isStale ? "This design changed after the estimate was generated." : "Generate a new estimate to use current pricing."}</p> : null}
    {visibleEstimate ? <><div className="mt-5 grid grid-cols-2 gap-4 border-y border-black/8 py-4 text-sm sm:grid-cols-3"><div><p className="text-xs text-black/45">Estimate number</p><p className="mt-1 font-semibold">{visibleEstimate.estimate_number}</p></div><div><p className="text-xs text-black/45">Generated</p><p className="mt-1">{formatOrderTimestamp(visibleEstimate.generated_at)}</p></div><div><p className="text-xs text-black/45">Valid until</p><p className="mt-1">{formatOrderTimestamp(visibleEstimate.valid_until)}</p></div><div><p className="text-xs text-black/45">Price per piece</p><p className="mt-1 font-semibold">{formatMoneyPaise(Math.round(visibleEstimate.taxable_subtotal_paise / (visibleEstimate.pricing_snapshot.quantity || 1)))}</p></div><div><p className="text-xs text-black/45">Estimated total</p><p className="mt-1 text-lg font-semibold">{formatMoneyPaise(visibleEstimate.total_paise)}</p><p className="text-xs text-black/45">Includes GST</p></div><div><p className="text-xs text-black/45">Due today</p><p className="mt-1 font-semibold">{formatMoneyPaise(visibleEstimate.reservation_fee_paise)}</p></div></div><dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-black/55">Merchandise subtotal</dt><dd>{formatMoneyPaise(visibleEstimate.subtotal_paise)}</dd></div><div className="flex justify-between gap-4"><dt className="text-black/55">Volume discount</dt><dd>-{formatMoneyPaise(visibleEstimate.discount_paise)}</dd></div><div className="flex justify-between gap-4"><dt className="text-black/55">GST</dt><dd>{formatMoneyPaise(visibleEstimate.gst_paise)}</dd></div><div className="flex justify-between gap-4 border-t border-black/8 pt-2 font-semibold"><dt>Estimated balance later</dt><dd>{formatMoneyPaise(visibleEstimate.balance_due_paise)}</dd></div></dl></> : null}
    <p className="mt-4 text-xs text-black/45">Shipping calculated after delivery address</p>
    <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => void generate()} disabled={loading} className="inline-flex items-center gap-2 rounded-[4px] bg-[#1D49B4] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173A91] disabled:opacity-60">{loading ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}{loading ? "Preparing estimate…" : actionLabel}</button>{visibleEstimate ? <><a href={`/api/estimates/${encodeURIComponent(visibleEstimate.id)}/pdf`} className="inline-flex items-center gap-2 rounded-[4px] border border-black/10 px-4 py-2.5 text-sm font-semibold hover:border-[#1D49B4]/35"><Download size={16} /> Download estimate</a><Link href={`/configurator/build/${encodeURIComponent(visibleEstimate.pricing_snapshot.product.id)}?designId=${encodeURIComponent(designId)}&estimateId=${encodeURIComponent(visibleEstimate.id)}`} className="inline-flex items-center gap-2 rounded-[4px] border border-[#1D49B4]/25 px-4 py-2.5 text-sm font-semibold text-[#1D49B4]"><ArrowRight size={16} /> Continue to order</Link></> : null}{visibleEstimate?.converted_order_id ? <Link href={`/account/orders/${encodeURIComponent(visibleEstimate.converted_order_id)}`} className="inline-flex items-center gap-2 rounded-[4px] border border-black/10 px-4 py-2.5 text-sm font-semibold"><ArrowRight size={16} /> View order</Link> : null}</div>
    {message ? <p role="alert" className="mt-3 text-sm text-red-700">{message}</p> : null}
    {estimates.length > 1 ? <details className="mt-6 border-t border-black/8 pt-4"><summary className="cursor-pointer text-sm font-semibold">Previous estimates</summary><div className="mt-3 divide-y divide-black/8">{estimates.slice(1).map((estimate) => { const status = deriveEstimateStatus(estimate); return <div key={estimate.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-medium">{estimate.estimate_number}</p><p className="text-xs text-black/45">{formatOrderTimestamp(estimate.generated_at)} · {estimateStatusLabel(status)}</p></div><div className="flex items-center gap-3"><span>{formatMoneyPaise(estimate.total_paise)}</span><a aria-label={`Download ${estimate.estimate_number}`} href={`/api/estimates/${encodeURIComponent(estimate.id)}/pdf`} className="text-[#1D49B4] hover:underline"><Download size={16} /></a></div></div>; })}</div></details> : null}
  </section>;
}
