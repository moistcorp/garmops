"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
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
  const [draft, setDraft] = useState<CartDraft>(() => createDraft(cartId));
  const [isDraftReady, setIsDraftReady] = useState(false);

  useEffect(() => {
    const loadDraft = window.setTimeout(() => {
      const savedDraft = readDraft(cartId);
      if (savedDraft.items.length === 0) {
        router.replace(`/configurator/cart/${encodeURIComponent(cartId)}/review`);
        return;
      }
      setDraft(savedDraft);
      setIsDraftReady(true);
    }, 0);

    return () => window.clearTimeout(loadDraft);
  }, [cartId, router]);

  const selectedDeliveryDate = useMemo(
    () => draft.selectedDeliveryDateIso ? new Date(draft.selectedDeliveryDateIso) : undefined,
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
    setDraft((previous) => {
      const next = { ...previous, ...patch };
      writeDraft(cartId, next);
      return next;
    });
  }, [cartId]);

  const updateProjectField = useCallback((field: "poNumber" | "orderNotes" | "receiveEmails", value: string | boolean) => {
    setDraft((previous) => {
      const shippingAddress = { ...previous.shippingAddress, [field]: value };
      const next = { ...previous, shippingAddress };
      writeDraft(cartId, next);
      return next;
    });
  }, [cartId]);

  const deliveryLabel = useMemo(
    () => formatDeliveryLabel(draft.deliveryType, selectedDeliveryDate),
    [selectedDeliveryDate, draft.deliveryType]
  );

  const shippingOk = isAddressValid(draft.shippingAddress);
  const billingOk = draft.sameAsShipping || isAddressValid(draft.billingAddress, { requireContact: false });
  const deliveryOk = isDeliverySelectionValid(
    draft.deliveryType,
    selectedDeliveryDate,
    deliveryBaseDate ?? new Date(),
    extraLeadTimeDays
  );
  const isValid = isDraftReady && draft.items.length > 0 && shippingOk && billingOk && deliveryOk;

  const missingMessage = useMemo(() => {
    if (!isDraftReady) return "Loading your project details…";
    const missing: string[] = [];
    if (!deliveryOk) missing.push("delivery target");
    if (!shippingOk) missing.push("shipping and project contact");
    if (!billingOk) missing.push("billing address");
    return missing.length ? `Complete ${missing.join(", ")} to continue.` : undefined;
  }, [billingOk, deliveryOk, isDraftReady, shippingOk]);

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
            <p className="text-xs font-medium uppercase tracking-wide text-[#111111]/50">Cart {cartId}</p>
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
          <p className="mt-3 text-xs leading-relaxed text-[#111111]/55">
            This is a target date. The final production schedule is confirmed after artwork review, approval and agreed payment terms.
          </p>
        </section>

        <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
          <AddressForm
            title="Shipping & project contact"
            value={draft.shippingAddress}
            showPO={false}
            showNotes={false}
            showMarketing={false}
            onChange={(shippingAddress) => updateDraft({ shippingAddress })}
          />
        </section>

        <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="rounded-full bg-[var(--color-teal)]/10 p-2 text-[var(--color-teal-dark)]">
              <Building2 size={18} />
            </span>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[#111111]">Project details</h3>
              <p className="mt-1 text-xs text-[#111111]/55">These details apply once to the complete order.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#111111]/70" htmlFor="project-po-number">PO number (optional)</label>
              <input
                id="project-po-number"
                className="w-full rounded-md border border-[#E5E5E5] bg-[#F7F7F7] px-3 py-2 text-sm focus:border-[var(--color-teal)] focus:outline-none"
                value={draft.shippingAddress.poNumber ?? ""}
                onChange={(event) => updateProjectField("poNumber", event.target.value)}
                placeholder="Add now or provide after approval"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#111111]/70" htmlFor="project-notes">Order notes (optional)</label>
              <textarea
                id="project-notes"
                rows={3}
                className="w-full rounded-md border border-[#E5E5E5] bg-[#F7F7F7] px-3 py-2 text-sm focus:border-[var(--color-teal)] focus:outline-none"
                value={draft.shippingAddress.orderNotes ?? ""}
                onChange={(event) => updateProjectField("orderNotes", event.target.value)}
                placeholder="Event date, packing instructions, approval requirements or anything our team should know"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-[#111111]/75">
              <input
                type="checkbox"
                checked={draft.shippingAddress.receiveEmails}
                onChange={(event) => updateProjectField("receiveEmails", event.target.checked)}
              />
              Receive occasional Garmops product and service updates
            </label>
          </div>
        </section>

        <label className="flex items-center gap-2 text-sm text-[#111111]">
          <input
            type="checkbox"
            checked={draft.sameAsShipping}
            onChange={(event) => updateDraft({ sameAsShipping: event.target.checked })}
          />
          Billing address is the same as shipping
        </label>

        {!draft.sameAsShipping && (
          <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
            <AddressForm
              title="Billing address"
              value={draft.billingAddress}
              showContact={false}
              showPO={false}
              showNotes={false}
              showMarketing={false}
              onChange={(billingAddress) => updateDraft({ billingAddress })}
            />
            <p className="mt-4 rounded-md bg-[#F7F7F7] px-3 py-2 text-xs text-[#111111]/55">
              Payment updates will be sent to the project contact above, so a second email and phone number are not required.
            </p>
          </section>
        )}

        <section className="space-y-2 rounded-lg border border-[#E5E5E5] bg-white p-5">
          <p className="text-sm font-medium text-[#111111]">Have a promo code?</p>
          <p className="text-sm text-[#111111]/60">Contact your account manager before reserving the production review.</p>
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
        disabledMessage={missingMessage}
      />
    </div>
  );
}
