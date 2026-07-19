"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DeliveryDatePicker } from "@/components/configurator/cart/DeliveryDatePicker";
import { AddressForm, isAddressValid } from "@/components/configurator/cart/AddressForm";
import { CartSummarySidebar } from "@/components/configurator/cart/CartSummarySidebar";
import { calculateTotals, readDraft, type CartDraft, writeDraft } from "./cartDraft";

export interface BillingShippingStepProps {
  cartId: string;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function BillingShippingStep({ cartId }: BillingShippingStepProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => readDraft(cartId));
  const [promoApplied, setPromoApplied] = useState(false);
  const selectedDeliveryDate = useMemo(
    () =>
      draft.selectedDeliveryDateIso
        ? new Date(draft.selectedDeliveryDateIso)
        : undefined,
    [draft.selectedDeliveryDateIso]
  );
  const totals = calculateTotals(draft.items, draft.deliveryType);

  const updateDraft = (patch: Partial<CartDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      writeDraft(cartId, next);
      return next;
    });
  };

  const deliveryLabel = useMemo(() => {
    if (!selectedDeliveryDate) return "Select a delivery date";
    const tag =
      draft.deliveryType === "rush"
        ? "Express"
        : draft.deliveryType === "standard"
        ? "Standard"
        : "Flexible";
    return `${tag} - ${formatDate(selectedDeliveryDate)}`;
  }, [selectedDeliveryDate, draft.deliveryType]);

  const isValid = useMemo(() => {
    const shippingOk = isAddressValid(draft.shippingAddress);
    const billingOk = draft.sameAsShipping || isAddressValid(draft.billingAddress);
    return shippingOk && billingOk && !!selectedDeliveryDate;
  }, [draft.shippingAddress, draft.billingAddress, draft.sameAsShipping, selectedDeliveryDate]);

  const handleNext = () => {
    router.push(`/configurator/cart/${encodeURIComponent(cartId)}/confirmation`);
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#111111]/50">
            Cart {cartId}
          </p>
          <h1 className="text-2xl font-semibold text-[#111111]">Invoice & Shipping</h1>
        </div>

        <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
          <DeliveryDatePicker
            onDateSelect={(date, type) => {
              updateDraft({
                selectedDeliveryDateIso: date.toISOString(),
                deliveryType: type,
              });
            }}
            selectedDate={selectedDeliveryDate}
          />
        </section>

        <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
          <AddressForm
            title="Shipping Address"
            value={draft.shippingAddress}
            onChange={(shippingAddress) => updateDraft({ shippingAddress })}
          />
        </section>

        <label className="flex items-center gap-2 text-sm text-[#111111]">
          <input
            type="checkbox"
            checked={draft.sameAsShipping}
            onChange={(e) => updateDraft({ sameAsShipping: e.target.checked })}
          />
          Same as shipping address
        </label>

        {!draft.sameAsShipping && (
          <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
            <AddressForm
              title="Billing Address"
              value={draft.billingAddress}
              onChange={(billingAddress) => updateDraft({ billingAddress })}
            />
          </section>
        )}

        <section className="space-y-2 rounded-lg border border-[#E5E5E5] bg-white p-5">
          <label className="text-xs font-medium text-[#111111]/70 block">
            Add promo code
          </label>
          <div className="flex gap-2">
            <input
              className="flex-1 border border-[#E5E5E5] bg-[#F7F7F7] px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111]"
              value={draft.promoCode}
              onChange={(e) => {
                updateDraft({ promoCode: e.target.value });
                setPromoApplied(false);
              }}
              placeholder="Enter code"
            />
            <button
              type="button"
              className="border border-[#111111] bg-[#111111] text-[#F7F7F7] px-4 py-2 text-sm hover:opacity-90 disabled:opacity-40"
              disabled={!draft.promoCode.trim()}
              onClick={() => setPromoApplied(true)}
            >
              Apply
            </button>
          </div>
          {promoApplied && (
            <p className="text-xs text-green-700">Promo code applied.</p>
          )}
        </section>
      </div>

      <CartSummarySidebar
        subtotal={totals.subtotal}
        volumeDiscount={totals.volumeDiscount}
        shippingFee={totals.shippingFee}
        gst={totals.gst}
        delivery={deliveryLabel}
        total={totals.total}
        onNext={handleNext}
        nextLabel="Next: Review & Payment"
        nextDisabled={!isValid}
      />
    </div>
  );
}
