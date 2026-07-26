"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { isAddressValid, type Address } from "./AddressForm";
import { CartSummarySidebar } from "./CartSummarySidebar";
import { CheckoutSteps } from "./CheckoutSteps";
import { PaymentMethodSelect } from "./PaymentMethodSelect";
import type { CartItem } from "./OrderReviewStep";
import {
  calculateTotals,
  createDraft,
  getCartItemDiscountPercent,
  getCartItemUnitPrice,
  readDraft,
  RESERVATION_FEE,
  totalUnits,
} from "./cartDraft";
import { formatDeliveryLabel, isDeliverySelectionValid } from "@/lib/configurator/delivery";
import { formatInr } from "@/lib/configurator/pricing";
import {
  CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS,
  CUSTOM_DYE_MOQ_UNITS,
} from "@/lib/configurator/colours";
import { getProduct } from "@/lib/configurator/products";
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
  const [isDraftReady, setIsDraftReady] = useState(false);
  useEffect(() => {
    const loadDraft = window.setTimeout(() => {
      const savedDraft = readDraft(cartId);
      if (savedDraft.items.length === 0) {
        router.replace(`/configurator/cart/${encodeURIComponent(cartId)}/review`);
        return;
      }
      const shippingComplete = isAddressValid(savedDraft.shippingAddress);
      const billingComplete =
        savedDraft.sameAsShipping || isAddressValid(savedDraft.billingAddress);
      const selectedDeliveryDate = savedDraft.selectedDeliveryDateIso
        ? new Date(savedDraft.selectedDeliveryDateIso)
        : undefined;
      const deliveryBaseDate = savedDraft.orderConfirmedDateIso
        ? new Date(savedDraft.orderConfirmedDateIso)
        : new Date();
      const extraLeadTimeDays = savedDraft.items.some(
        (item) => item.colour.type === "custom_dye"
      );
      const deliveryComplete = isDeliverySelectionValid(
        savedDraft.deliveryType,
        selectedDeliveryDate,
        deliveryBaseDate,
        extraLeadTimeDays ? CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS.max : 0
      );

      if (!shippingComplete || !billingComplete || !deliveryComplete) {
        router.replace(
          `/configurator/cart/${encodeURIComponent(cartId)}/shipping`
        );
        return;
      }

      setDraft(savedDraft);
      setIsDraftReady(true);
    }, 0);

    return () => window.clearTimeout(loadDraft);
  }, [cartId, router]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("payu");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const { subtotal, volumeDiscount, shippingFee, gst, delivery, orderTotal, balanceDue } =
    useMemo(() => {
      const totals = calculateTotals(draft.items, draft.deliveryType);
      const delivery = formatDeliveryLabel(
        draft.deliveryType,
        draft.selectedDeliveryDateIso ? new Date(draft.selectedDeliveryDateIso) : undefined
      );

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
    setPaymentError("");

    const hasValidItems =
      draft.items.length > 0 &&
      draft.items.every((item) => {
        const minimum = item.colour.type === "custom_dye" ? CUSTOM_DYE_MOQ_UNITS : 50;
        return totalUnits(item.sizeQuantities) >= minimum;
      });
    const shippingComplete = isAddressValid(draft.shippingAddress);
    const billingComplete =
      draft.sameAsShipping || isAddressValid(draft.billingAddress);
    const selectedDeliveryDate = draft.selectedDeliveryDateIso
      ? new Date(draft.selectedDeliveryDateIso)
      : undefined;
    const deliveryBaseDate = draft.orderConfirmedDateIso
      ? new Date(draft.orderConfirmedDateIso)
      : new Date();
    const extraLeadTimeDays = draft.items.some(
      (item) => item.colour.type === "custom_dye"
    )
      ? CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS.max
      : 0;
    const deliveryComplete = isDeliverySelectionValid(
      draft.deliveryType,
      selectedDeliveryDate,
      deliveryBaseDate,
      extraLeadTimeDays
    );
    const firstname = billingAddress.firstName.trim();
    const email = billingAddress.email.trim();

    if (
      !hasValidItems ||
      !shippingComplete ||
      !billingComplete ||
      !deliveryComplete
    ) {
      setPaymentError(
        "Your order or billing details are incomplete. Return to the previous steps and review them."
      );
      return;
    }

    setIsProcessing(true);
    const randomSuffix = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    const txnid = `MF${Date.now().toString(36)}${randomSuffix}`;
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

      const payment = await res.json();
      if (
        !res.ok ||
        payment.amount !== amount ||
        typeof payment.productinfo !== "string" ||
        typeof payment.udf1 !== "string"
      ) {
        throw new Error(payment.error || "Unable to start payment");
      }
      if (!payment.mockPayment && (!payment.hash || !payment.key)) {
        throw new Error("PayU returned an invalid payment response");
      }

      window.localStorage.setItem(
        "mf_pending_order",
        JSON.stringify({
          kind: "configurator",
          mockPayment: Boolean(payment.mockPayment),
          txnid,
          name: `${billingAddress.firstName} ${billingAddress.lastName}`.trim(),
          email,
          amount,
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
            .map((item) => {
              const sizes = getProduct(item.productId)?.sizes ?? Object.keys(item.sizeQuantities);
              return sizes
                .map((size) => `${size}: ${item.sizeQuantities[size] ?? 0}`)
                .join(", ");
            })
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

      if (payment.mockPayment) {
        window.location.assign(
          `/api/payu/callback?token=${encodeURIComponent(payment.udf1)}`
        );
        return;
      }

      const { hash, key } = payment;

      const payuForm = document.createElement("form");
      payuForm.method = "POST";
      payuForm.action =
        process.env.NEXT_PUBLIC_PAYU_BASE_URL ??
        (process.env.NODE_ENV === "production"
          ? "https://secure.payu.in/_payment"
          : "https://test.payu.in/_payment");

      const fields: Record<string, string> = {
        key,
        txnid,
        amount,
        productinfo: payment.productinfo,
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
        udf1: payment.udf1,
        surl: `${window.location.origin}/api/payu/callback`,
        furl: `${window.location.origin}/api/payu/callback`,
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
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : "Could not start PayU payment. Please try again."
      );
      setIsProcessing(false);
    }
  };

  if (!isDraftReady) {
    return (
      <div
        className="flex min-h-[320px] items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <LoaderCircle
          className="animate-spin text-[var(--color-teal)]"
          size={28}
          aria-hidden="true"
        />
        <span className="sr-only">Validating shipping details</span>
      </div>
    );
  }

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
            className="inline-flex items-center gap-2 self-start rounded-full border border-[#E5E5E5] px-4 py-2 text-sm font-medium text-[#111111]/75 hover:border-[var(--color-teal)] hover:text-[#111111] sm:self-auto"
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
            I understand and agree to the reservation terms below
          </label>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-relaxed text-[#111111]/60">
            <li>₹499 reserves the production review and is charged today.</li>
            <li>The final invoice, including confirmed shipping, is shared after feasibility review.</li>
            <li>Production starts only after final approval and the agreed balance-payment terms.</li>
          </ul>
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
          className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-medium transition-colors ${
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
  const unitPrice = getCartItemUnitPrice(item);
  const discountPercent = getCartItemDiscountPercent(item);
  const productSizes = getProduct(item.productId)?.sizes ?? Object.keys(item.sizeQuantities);

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
          {item.colour.name || "Bright White"} · {units} units · {formatInr(unitPrice)}/unit
          {discountPercent > 0 ? ` · ${discountPercent}% off` : ""}
        </p>
        <div
          className="mt-2 grid gap-1 text-[10px] text-[#111111]/60"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, productSizes.length)}, minmax(0, 1fr))` }}
        >
          {productSizes.map((size) => (
            <div key={size} className="text-center">
              <div className="font-medium text-[#111111]">{size}</div>
              <div>{item.sizeQuantities[size] ?? 0}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
