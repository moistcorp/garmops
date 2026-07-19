"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Address } from "./AddressForm";
import { CartSummarySidebar } from "./CartSummarySidebar";
import { PaymentMethodSelect } from "./PaymentMethodSelect";
import { SIZES } from "./SizeQuantityGrid";
import type { CartItem } from "./OrderReviewStep";
import type { Order, PaymentStatus } from "@/lib/configurator/types/cart";
import { calculateTotals, readDraft, RESERVATION_FEE, totalUnits } from "./cartDraft";
import { formatInr, getUnitPriceAdjustments } from "@/lib/configurator/pricing";

export interface ConfirmationStepProps {
  cartId: string;
}

export function ConfirmationStep({ cartId }: ConfirmationStepProps) {
  const router = useRouter();
  const [draft] = useState(() => readDraft(cartId));
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("payu");

  const { subtotal, volumeDiscount, shippingFee, gst, delivery, orderTotal, balanceDue, paymentStatus } =
    useMemo(() => {
      const totals = calculateTotals(draft.items, draft.deliveryType);
      const paymentStatus: PaymentStatus = "reservation_paid";
      const delivery = draft.selectedDeliveryDateIso
        ? `${draft.deliveryType === "rush" ? "Express" : draft.deliveryType ?? "standard"} - ${new Date(
            draft.selectedDeliveryDateIso
          ).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
        : "Delivery date not selected";

      return {
        subtotal: totals.subtotal,
        volumeDiscount: totals.volumeDiscount,
        shippingFee: totals.shippingFee,
        gst: totals.gst,
        delivery,
        orderTotal: totals.total,
        balanceDue: totals.balanceDue,
        paymentStatus,
      };
    }, [draft]);

  const billingAddress = draft.sameAsShipping ? draft.shippingAddress : draft.billingAddress;

  const order: Order = {
    reservationFeePaid: RESERVATION_FEE,
    orderTotal,
    balanceDue,
    paymentStatus,
  };

  const handlePrebook = () => {
    // Stub — actual PayU trigger is wired in a future phase, outside this namespace.
    console.log("Pre-book your order", {
      cartId,
      shippingAddress: draft.shippingAddress,
      billingAddress,
      sameAsShipping: draft.sameAsShipping,
      cartItems: draft.items,
      paymentMethod,
      order,
    });
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#111111]/50">
            Cart {cartId}
          </p>
          <h1 className="text-2xl font-semibold text-[#111111]">Review & Payment</h1>
        </div>

        {/* Shipping Address */}
        <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[#111111]">Shipping Address</h3>
            <button
              type="button"
              onClick={() => router.push(`/configurator/cart/${encodeURIComponent(cartId)}/shipping`)}
              className="text-xs underline text-[#111111]/70 hover:text-[#111111]"
            >
              Edit details
            </button>
          </div>
          <AddressSummary address={draft.shippingAddress} />
        </section>

        {/* Billing Address */}
        <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[#111111]">Billing Address</h3>
            {!draft.sameAsShipping && (
              <button
                type="button"
                onClick={() => router.push(`/configurator/cart/${encodeURIComponent(cartId)}/shipping`)}
                className="text-xs underline text-[#111111]/70 hover:text-[#111111]"
              >
                Edit details
              </button>
            )}
          </div>
          {draft.sameAsShipping ? (
            <p className="text-sm text-[#111111]/70">Same as shipping address</p>
          ) : (
            <AddressSummary address={billingAddress} />
          )}
        </section>

        {/* Product recap */}
        <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
          <h3 className="text-sm font-medium text-[#111111] mb-4">Order Summary</h3>
          <div className="space-y-4">
            {draft.items.map((item) => (
              <ProductRecapCard key={item.id} item={item} />
            ))}
          </div>
        </section>

        {/* Payment method */}
        <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
          <PaymentMethodSelect value={paymentMethod} onChange={setPaymentMethod} />
        </section>

        {/* Terms */}
        <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
          <label className="flex items-start gap-3 text-sm text-[#111111] cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#111111]"
            />
            Agree to terms & conditions
          </label>
        </section>
      </div>

      {/* Summary sidebar — extended with reservation fee / balance due.
          NOTE: CartSummarySidebar.tsx itself is not in this phase's Files Touched
          list, so these extra lines are composed here rather than added as props
          on that component. Flag for promotion into CartSummarySidebarProps
          (reservationFee?, balanceDue?) in a future phase. */}
      <div className="space-y-4">
        <CartSummarySidebar
          subtotal={subtotal}
          volumeDiscount={volumeDiscount}
          shippingFee={shippingFee}
          gst={gst}
          delivery={delivery}
          total={orderTotal}
        />
        <div className="rounded-lg border border-[#E5E5E5] bg-white p-5 space-y-2 text-sm">
          <div className="flex justify-between text-[#111111]/70">
            <span>Reservation fee paid</span>
            <span>{formatInr(RESERVATION_FEE)}</span>
          </div>
          <div className="flex justify-between text-[#111111]/70">
            <span>Order total</span>
            <span>{formatInr(orderTotal)}</span>
          </div>
          <div className="flex justify-between font-medium text-[#111111] pt-2 border-t border-[#E5E5E5]">
            <span>Balance due</span>
            <span>{formatInr(balanceDue)}</span>
          </div>
        </div>
        <button
          type="button"
          disabled={!termsAccepted}
          onClick={handlePrebook}
          className={`w-full rounded-lg py-3 text-sm font-medium transition-colors ${
            termsAccepted
              ? "bg-[#111111] text-white hover:bg-[#111111]/90"
              : "bg-[#E5E5E5] text-[#111111]/40 cursor-not-allowed"
          }`}
        >
          Pre-book your order
        </button>
      </div>
    </div>
  );
}

function AddressSummary({ address }: { address: Address }) {
  return (
    <div className="text-sm text-[#111111]/80 space-y-1">
      <p className="font-medium text-[#111111]">
        {address.firstName} {address.lastName}
        {address.company ? ` · ${address.company}` : ""}
      </p>
      <p>{address.addressLine1}</p>
      {address.addressLine2 && <p>{address.addressLine2}</p>}
      <p>
        {address.city}
        {address.state ? `, ${address.state}` : ""} {address.zip}
      </p>
      <p>{address.country}</p>
      <p className="pt-1 text-[#111111]/60">
        {address.email} · {address.phone}
      </p>
    </div>
  );
}

function ProductRecapCard({ item }: { item: CartItem }) {
  const units = totalUnits(item.sizeQuantities);
  const adjustments = getUnitPriceAdjustments(item.colour, item.artwork, item.neckLabel);

  return (
    <div className="flex gap-4 border border-[#E5E5E5] rounded-lg p-4">
      <img
        src={item.previewImage}
        alt={item.productName}
        className="h-20 w-20 rounded-md object-cover bg-[#F7F7F7]"
      />
      <div className="flex-1">
        <p className="text-sm font-medium text-[#111111]">{item.productName}</p>
        <p className="text-xs text-[#111111]/60">
          {item.colour.name} · {units} units · {formatInr(item.unitPrice)}/unit
        </p>
        <div className="mt-2 grid grid-cols-6 gap-1 text-[10px] text-[#111111]/60">
          {SIZES.map((size) => (
            <div key={size} className="text-center">
              <div className="font-medium text-[#111111]">{size}</div>
              <div>{item.sizeQuantities[size] ?? 0}</div>
            </div>
          ))}
        </div>
        {adjustments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {adjustments.map((adjustment) => (
              <span
                key={adjustment.label}
                className="rounded-full border border-[#E5E5E5] px-2 py-1 text-[10px] text-[#111111]/60"
              >
                {adjustment.label} +{adjustment.percent}%
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
