"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import type { Address } from "./AddressForm";
import { CartSummarySidebar } from "./CartSummarySidebar";
import { CheckoutSteps } from "./CheckoutSteps";
import { PaymentMethodSelect } from "./PaymentMethodSelect";
import { SIZES } from "./SizeQuantityGrid";
import type { CartItem } from "./OrderReviewStep";
import { calculateTotals, createDraft, readDraft, RESERVATION_FEE, totalUnits } from "./cartDraft";
import { formatInr, getUnitPriceAdjustments } from "@/lib/configurator/pricing";
import CanvasRenderer from "../GarmentPreview/CanvasRenderer";
import { ArtworkPositionProvider } from "@/lib/configurator/ArtworkPositionContext";

export interface ConfirmationStepProps {
  cartId: string;
}

export function ConfirmationStep({ cartId }: ConfirmationStepProps) {
  const router = useRouter();
  // Start from a deterministic empty draft so the server-rendered markup and
  // the client's first render match exactly, then load the real
  // localStorage-backed draft once mounted (see BillingShippingStep for the
  // same pattern — reading localStorage inside the useState initializer runs
  // on the client's first render too, which doesn't match what the server
  // sent and trips a hydration error).
  const [draft, setDraft] = useState(() => createDraft(cartId));
  useEffect(() => {
    const loadDraft = window.setTimeout(() => {
      setDraft(readDraft(cartId));
    }, 0);

    return () => window.clearTimeout(loadDraft);
  }, [cartId]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("payu");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const { subtotal, volumeDiscount, shippingFee, gst, delivery, orderTotal, balanceDue } =
    useMemo(() => {
      const totals = calculateTotals(draft.items, draft.deliveryType);
      const delivery = draft.selectedDeliveryDateIso
        ? `${draft.deliveryType === "rush" ? "Rush" : draft.deliveryType ?? "standard"} - ${new Date(
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
      };
    }, [draft]);

  const billingAddress = draft.sameAsShipping ? draft.shippingAddress : draft.billingAddress;

  const handlePayment = async () => {
    setIsProcessing(true);
    setPaymentError("");

    const firstname = billingAddress.firstName || draft.shippingAddress.firstName || "Garmops";
    const email = billingAddress.email || draft.shippingAddress.email;
    const txnid = `MF${Date.now()}`;
    const amount = RESERVATION_FEE.toFixed(2);
    const productinfo = `Reservation fee - ${draft.items
      .map((item) => `${item.productName} x${totalUnits(item.sizeQuantities)}`)
      .join(", ")}`;

    try {
      const res = await fetch("/api/payu/hash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txnid, amount, productinfo, firstname, email }),
      });

      if (!res.ok) {
        throw new Error("Unable to start payment");
      }

      const { hash, key } = await res.json();

      window.localStorage.setItem(
        "mf_pending_order",
        JSON.stringify({
          txnid,
          name: `${billingAddress.firstName} ${billingAddress.lastName}`.trim(),
          email,
          product: draft.items.map((item) => item.productName).join(", "),
          color: draft.items.map((item) => item.colour.name || "Bright White").join(", "),
          technique: "Configurator order",
          placements: draft.items
            .map((item) =>
              [item.artwork.front?.confirmed && "Front", item.artwork.back?.confirmed && "Back"]
                .filter(Boolean)
                .join(" + ")
            )
            .filter(Boolean)
            .join(", "),
          neckLabel: draft.items.some((item) => item.neckLabel?.confirmed) ? "Added" : "Not added",
          totalQty: draft.items.reduce((sum, item) => sum + totalUnits(item.sizeQuantities), 0),
          sizeBreakdown: draft.items
            .map((item) =>
              SIZES.map((size) => `${size}: ${item.sizeQuantities[size] ?? 0}`).join(", ")
            )
            .join(" | "),
          estimatedTotal: formatInr(orderTotal),
          retryHref: `/configurator/cart/${encodeURIComponent(cartId)}/confirmation`,
          shipping: {
            addressLine1: draft.shippingAddress.addressLine1,
            city: draft.shippingAddress.city,
            state: draft.shippingAddress.state,
            pincode: draft.shippingAddress.zip,
          },
        })
      );

      const payuForm = document.createElement("form");
      payuForm.method = "POST";
      payuForm.action = process.env.NEXT_PUBLIC_PAYU_BASE_URL ?? "https://secure.payu.in/_payment";

      const fields: Record<string, string> = {
        key,
        txnid,
        amount,
        productinfo,
        firstname,
        lastname: billingAddress.lastName,
        email,
        phone: billingAddress.phone || draft.shippingAddress.phone,
        address1: billingAddress.addressLine1,
        city: billingAddress.city,
        state: billingAddress.state ?? "",
        zipcode: billingAddress.zip,
        country: billingAddress.country,
        hash,
        surl: `${window.location.origin}/payment/success`,
        furl: `${window.location.origin}/payment/failure`,
      };

      Object.entries(fields).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        payuForm.appendChild(input);
      });

      document.body.appendChild(payuForm);
      payuForm.submit();
    } catch {
      setPaymentError("Could not start PayU payment. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <CheckoutSteps currentStep="payment" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#111111]/50">
              Cart {cartId}
            </p>
            <h1 className="text-2xl font-semibold text-[#111111]">Review & Payment</h1>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/configurator/cart/${encodeURIComponent(cartId)}/shipping`)}
            className="inline-flex items-center gap-2 self-start rounded-md border border-[#E5E5E5] px-4 py-2 text-sm font-medium text-[#111111]/75 hover:border-[var(--color-teal)] hover:text-[#111111] sm:self-auto"
          >
            <ArrowLeft size={16} strokeWidth={2.2} />
            Back to Invoice & Shipping
          </button>
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
              className="mt-0.5 h-4 w-4 accent-[var(--color-teal)]"
            />
            Agree to terms & conditions
          </label>
          <p className="mt-3 text-xs text-[#111111]/60">
            Payments are processed securely via PayU. Full terms apply.
          </p>
        </section>
      </div>

      {/* Summary sidebar — extended here with reservation-specific payment copy. */}
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
            <span>Reservation fee due today</span>
            <span>{formatInr(RESERVATION_FEE)}</span>
          </div>
          <div className="flex justify-between text-[#111111]/70">
            <span>Estimated order total</span>
            <span>{formatInr(orderTotal)}</span>
          </div>
          <div className="flex justify-between text-[#111111]/70">
            <span>Shipping charges</span>
            <span>Quoted separately</span>
          </div>
          <div className="flex justify-between font-medium text-[#111111] pt-2 border-t border-[#E5E5E5]">
            <span>Estimated balance after reservation</span>
            <span>{formatInr(balanceDue)}</span>
          </div>
          <p className="pt-2 text-xs text-[#111111]/60">
            After you pay the reservation fee, we review the artwork, confirm production
            feasibility, and share the final invoice with shipping. The balance is due before
            production starts, payable by bank transfer or your agreed B2B payment terms.
          </p>
        </div>
        <button
          type="button"
          disabled={!termsAccepted || isProcessing}
          onClick={handlePayment}
          className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium transition-colors ${
            termsAccepted && !isProcessing
              ? "bg-[var(--color-teal)] text-white hover:bg-[var(--color-teal-dark)]"
              : "bg-[#E5E5E5] text-[#111111]/40 cursor-not-allowed"
          }`}
        >
          {isProcessing && <LoaderCircle size={16} className="animate-spin" />}
          {isProcessing ? "Processing…" : "Pay reservation fee"}
        </button>
        {paymentError && (
          <p role="alert" className="text-xs font-medium text-[#C62828]">
            {paymentError}
          </p>
        )}
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
      {address.gstin && <p>GSTIN: {address.gstin}</p>}
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
  const adjustments = getUnitPriceAdjustments(
    item.colour,
    item.artwork,
    item.neckLabel,
    item.rushDelivery
  );

  return (
    <div className="flex gap-4 border border-[#E5E5E5] rounded-lg p-4">
      <div className="h-24 w-20 shrink-0 overflow-hidden rounded-md bg-[#F7F7F7]">
        <ArtworkPositionProvider activeView="front">
          <CanvasRenderer
            view="front"
            colourHex={item.colour.hex}
            productId={item.productId}
            artwork={item.artwork}
            neckLabel={item.neckLabel}
            interactive={false}
            className="h-full w-full bg-[#F7F7F7]"
          />
        </ArtworkPositionProvider>
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-[#111111]">{item.productName}</p>
        <p className="text-xs text-[#111111]/60">
          {item.colour.name || "Bright White"} · {units} units · {formatInr(item.unitPrice)}/unit
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
                {adjustment.amount
                  ? `${adjustment.label} +${formatInr(adjustment.amount)}`
                  : `${adjustment.label} +${adjustment.percent}%`}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
