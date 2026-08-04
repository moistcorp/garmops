"use client";

import { useState } from "react";
import { CreditCard, LoaderCircle } from "lucide-react";
import { submitPayuCheckout } from "@/lib/payuClient";

export default function StaffQuoteCheckout({ token, totalPaise }: { token: string; totalPaise: number }) {
  const [discountCode, setDiscountCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setPending(true);
    setError("");
    try {
      const prepare = await fetch(`/api/quotes/${encodeURIComponent(token)}/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountCode: discountCode.trim() || undefined, acceptedTerms, acceptedPrivacy }),
      });
      const prepared = await prepare.json() as { error?: string; alreadyFinalized?: boolean; orderNumber?: string; checkoutPaymentAttemptId?: string | null };
      if (!prepare.ok) throw new Error(prepared.error ?? "Quotation payment could not be prepared");
      if (prepared.alreadyFinalized && prepared.orderNumber) {
        window.location.assign(`/account/orders/${encodeURIComponent(prepared.orderNumber)}`);
        return;
      }
      if (!prepared.checkoutPaymentAttemptId) throw new Error("Payment attempt is unavailable");
      const response = await fetch("/api/payments/payu/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutPaymentAttemptId: prepared.checkoutPaymentAttemptId }),
      });
      const checkout = await response.json() as { error?: string; checkoutUrl?: string; fields?: Record<string, string> };
      if (!response.ok || !checkout.checkoutUrl || !checkout.fields) throw new Error(checkout.error ?? "Secure payment could not be started");
      submitPayuCheckout(checkout.fields, checkout.checkoutUrl);
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Secure payment could not be started");
      setPending(false);
    }
  }

  const displayed = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(totalPaise / 100);
  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold">Discount code
        <input value={discountCode} onChange={(event) => setDiscountCode(event.target.value.toUpperCase())} maxLength={32} className="mt-1 w-full rounded border border-black/10 px-3 py-2 font-mono text-sm uppercase" placeholder="Optional" />
      </label>
      <label className="flex items-start gap-2 text-xs leading-relaxed text-black/60"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-0.5" />I accept the Garmops terms for this full-payment order.</label>
      <label className="flex items-start gap-2 text-xs leading-relaxed text-black/60"><input type="checkbox" checked={acceptedPrivacy} onChange={(event) => setAcceptedPrivacy(event.target.checked)} className="mt-0.5" />I accept the privacy notice and confirm the quoted email identity.</label>
      <button type="button" onClick={pay} disabled={pending || !acceptedTerms || !acceptedPrivacy} className="techpack-button inline-flex w-full items-center justify-center gap-2 disabled:opacity-50">
        {pending ? <LoaderCircle size={16} className="animate-spin" /> : <CreditCard size={16} />}
        {pending ? "Opening secure payment…" : `Continue to PayU · ${displayed}`}
      </button>
      <p className="text-[11px] leading-relaxed text-black/45">The final amount is recalculated server-side. Shipping is excluded and will be collected separately by staff through a PayU payment link.</p>
      {error ? <p className="text-xs text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
