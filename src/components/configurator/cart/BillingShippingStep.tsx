"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DeliveryDatePicker } from "@/components/configurator/cart/DeliveryDatePicker";
import { AddressForm, isAddressValid } from "@/components/configurator/cart/AddressForm";
import { CartSummarySidebar } from "@/components/configurator/cart/CartSummarySidebar";
import { CheckoutSteps } from "@/components/configurator/cart/CheckoutSteps";
import { calculateTotals, createDraft, readDraft, type CartDraft, writeDraft } from "./cartDraft";
import { formatDeliveryLabel, isDeliverySelectionValid } from "@/lib/configurator/delivery";
import { CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS } from "@/lib/configurator/colours";

export interface BillingShippingStepProps {
  cartId: string;
}

export function BillingShippingStep({ cartId }: BillingShippingStepProps) {
  const router = useRouter();
  // Deterministic empty draft on the first render (server AND client) so
  // hydration matches; the real draft (read from localStorage) is loaded
  // right after mount. Reading localStorage directly in the useState
  // initializer was the cause of the "Hydration failed" error — on the
  // client, `window` already exists on that very first render, so it
  // returned the saved delivery date/type immediately while the server
  // markup was rendered with none, and the two didn't match.
  const [draft, setDraft] = useState<CartDraft>(() => createDraft(cartId));
  useEffect(() => {
    const loadDraft = window.setTimeout(() => {
      setDraft(readDraft(cartId));
    }, 0);

    return () => window.clearTimeout(loadDraft);
  }, [cartId]);
  const selectedDeliveryDate = useMemo(
    () =>
      draft.selectedDeliveryDateIso
        ? new Date(draft.selectedDeliveryDateIso)
        : undefined,
    [draft.selectedDeliveryDateIso]
  );
  const totals = calculateTotals(draft.items, draft.deliveryType);
  const extraLeadTimeDays = draft.items.some((item) => item.colour.type === "custom_dye")
    ? CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS.max
    : 0;
  const deliveryBaseDate = useMemo(
    () => draft.orderConfirmedDateIso ? new Date(draft.orderConfirmedDateIso) : undefined,
    [draft.orderConfirmedDateIso]
  );

  const updateDraft = useCallback((patch: Partial<CartDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      writeDraft(cartId, next);
      return next;
    });
  }, [cartId]);

  const deliveryLabel = useMemo(() => {
    return formatDeliveryLabel(draft.deliveryType, selectedDeliveryDate);
  }, [selectedDeliveryDate, draft.deliveryType]);

  const isValid = useMemo(() => {
    const shippingOk = isAddressValid(draft.shippingAddress);
    const billingOk = draft.sameAsShipping || isAddressValid(draft.billingAddress);
    const deliveryOk = isDeliverySelectionValid(
      draft.deliveryType,
      selectedDeliveryDate,
      deliveryBaseDate ?? new Date(),
      extraLeadTimeDays
    );
    return shippingOk && billingOk && deliveryOk;
  }, [
    draft.shippingAddress,
    draft.billingAddress,
    draft.sameAsShipping,
    draft.deliveryType,
    selectedDeliveryDate,
    deliveryBaseDate,
    extraLeadTimeDays,
  ]);

  const handleNext = () => {
    if (!isValid) return;
    router.push(`/configurator/cart/${encodeURIComponent(cartId)}/confirmation`);
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <CheckoutSteps currentStep="shipping" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#111111]/50">
              Cart {cartId}
            </p>
            <h1 className="text-2xl font-semibold text-[#111111]">Invoice & Shipping</h1>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/configurator/cart/${encodeURIComponent(cartId)}/review`)}
            className="inline-flex items-center gap-2 self-start rounded-full border border-[#E5E5E5] px-4 py-2 text-sm font-medium text-[#111111]/75 hover:border-[var(--color-teal)] hover:text-[#111111] sm:self-auto"
          >
            <ArrowLeft size={16} strokeWidth={2.2} />
            Back to Order Summary
          </button>
        </div>

        <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
          <DeliveryDatePicker
            orderConfirmedDate={deliveryBaseDate}
            extraLeadTimeDays={extraLeadTimeDays}
            onDateSelect={(date, type) => {
              updateDraft({
                selectedDeliveryDateIso: date.toISOString(),
                deliveryType: type,
                orderConfirmedDateIso: draft.orderConfirmedDateIso ?? new Date().toISOString(),
              });
            }}
            selectedDate={selectedDeliveryDate}
            selectedType={draft.deliveryType}
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
          <p className="text-sm font-medium text-[#111111]">Have a promo code?</p>
          <p className="text-sm text-[#111111]/60">Contact your account manager.</p>
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
