"use client";

import { useActionState } from "react";
import { createStaffQuoteAction } from "@/app/staff/actions";
import { INITIAL_STAFF_ACTION_STATE } from "@/lib/staff/actionState";

const exampleConfiguration = {
  schemaVersion: 1,
  kind: "configurator_build",
  configId: "regular-fit-tee-200gsm",
  savedAt: "2026-08-04T06:30:00.000Z",
  configuration: {
    colour: { type: "signature", name: "Bright White", hex: "#FFFFFF", confirmed: true },
    artwork: {},
    steps: [
      { id: "garment-colour", title: "Garment colour", summary: "Bright White", confirmed: true },
      { id: "artwork", title: "Artwork", summary: null, confirmed: false, skipped: true },
      { id: "neck-label", title: "Neck label", summary: null, confirmed: false, skipped: true },
    ],
    quantity: 50,
  },
};

const exampleSizes = { XS: 5, S: 10, M: 15, L: 10, XL: 5, XXL: 5 };
const inputClass = "mt-1 w-full rounded border border-black/10 bg-white px-3 py-2 text-sm";

export default function StaffQuoteForm() {
  const [state, action, pending] = useActionState(createStaffQuoteAction, INITIAL_STAFF_ACTION_STATE);
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold">Customer name<input name="customerName" required className={inputClass} /></label>
        <label className="text-xs font-semibold">Customer email<input name="customerEmail" type="email" required className={inputClass} /></label>
        <label className="text-xs font-semibold">Customer phone<input name="customerPhone" required placeholder="9876543210" className={inputClass} /></label>
        <label className="text-xs font-semibold">Delivery speed<select name="deliveryType" defaultValue="standard" className={inputClass}><option value="standard">Standard</option><option value="rush">Rush</option><option value="flexible">Flexible</option></select></label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="text-xs font-semibold">Validated configurator snapshot<textarea name="configuration" required rows={18} spellCheck={false} defaultValue={JSON.stringify(exampleConfiguration, null, 2)} className={`${inputClass} font-mono text-[11px]`} /></label>
        <div className="space-y-4">
          <label className="block text-xs font-semibold">Size allocation JSON<textarea name="sizeQuantities" required rows={8} spellCheck={false} defaultValue={JSON.stringify(exampleSizes, null, 2)} className={`${inputClass} font-mono text-[11px]`} /></label>
          <label className="block text-xs font-semibold">Quote validity<select name="expiresInDays" defaultValue="7" className={inputClass}><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></label>
          <p className="rounded border border-black/8 bg-[var(--color-cream-soft)] p-3 text-[11px] leading-relaxed text-black/55">Foundry never accepts a typed price. Product, quantity, decoration, volume discount, HSN, GST, and full payable amount are recalculated from this validated snapshot by the server.</p>
        </div>
      </div>

      <fieldset className="rounded border border-black/8 p-4"><legend className="px-2 text-xs font-semibold">Billing</legend><div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold">Billing entity<input name="billingEntity" required className={inputClass} /></label>
        <label className="text-xs font-semibold">Billing email<input name="billingEmail" type="email" required className={inputClass} /></label>
        <label className="text-xs font-semibold">GSTIN (optional)<input name="billingGstin" className={`${inputClass} uppercase`} /></label>
        <label className="text-xs font-semibold">Address line 1<input name="billingAddressLine1" required className={inputClass} /></label>
        <label className="text-xs font-semibold">Address line 2<input name="billingAddressLine2" className={inputClass} /></label>
        <label className="text-xs font-semibold">PIN code<input name="billingZip" required inputMode="numeric" className={inputClass} /></label>
        <label className="text-xs font-semibold">City<input name="billingCity" required className={inputClass} /></label>
        <label className="text-xs font-semibold">State<input name="billingState" required className={inputClass} /></label>
      </div></fieldset>

      <fieldset className="rounded border border-black/8 p-4"><legend className="px-2 text-xs font-semibold">Delivery</legend><div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold">Recipient<input name="shippingRecipientName" required className={inputClass} /></label>
        <label className="text-xs font-semibold">Address line 1<input name="shippingAddressLine1" required className={inputClass} /></label>
        <label className="text-xs font-semibold">Address line 2<input name="shippingAddressLine2" className={inputClass} /></label>
        <label className="text-xs font-semibold">PIN code<input name="shippingZip" required inputMode="numeric" className={inputClass} /></label>
        <label className="text-xs font-semibold">City<input name="shippingCity" required className={inputClass} /></label>
        <label className="text-xs font-semibold">State<input name="shippingState" required className={inputClass} /></label>
      </div></fieldset>

      <button type="submit" disabled={pending} className="techpack-button w-full">{pending ? "Pricing and creating…" : "Create secure payment quotation"}</button>
      {state.status !== "idle" ? <p className={`whitespace-pre-wrap break-words text-xs ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`} role="status">{state.message}</p> : null}
    </form>
  );
}
