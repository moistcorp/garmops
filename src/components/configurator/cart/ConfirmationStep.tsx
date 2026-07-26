"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, LoaderCircle, ShieldCheck } from "lucide-react";
import { isAddressValid, type Address } from "./AddressForm";
import { CartSummarySidebar } from "./CartSummarySidebar";
import { CheckoutSteps } from "./CheckoutSteps";
import type { CartItem } from "./OrderReviewStep";
import {
  calculateTotals,
  createDraft,
  getCartItemDiscountPercent,
  getCartItemUnitPrice,
  readDraft,
  totalUnits,
} from "./cartDraft";
import { formatDeliveryLabel, isDeliverySelectionValid } from "@/lib/configurator/delivery";
import { formatInr } from "@/lib/configurator/pricing";
import {
  CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS,
  CUSTOM_DYE_MOQ_UNITS,
} from "@/lib/configurator/colours";
import { getProduct } from "@/lib/configurator/products";
import { RESERVATION_FEE } from "@/lib/configurator/reservation";
import CanvasRenderer from "../GarmentPreview/CanvasRenderer";
import { ArtworkPositionProvider } from "@/lib/configurator/ArtworkPositionContext";

export interface ConfirmationStepProps {
  cartId: string;
}

export function ConfirmationStep({ cartId }: ConfirmationStepProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => createDraft(cartId));
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    const loadDraft = window.setTimeout(() => {
      const savedDraft = readDraft(cartId);
      if (savedDraft.items.length === 0) {
        router.replace(`/configurator/cart/${encodeURIComponent(cartId)}/review`);
        return;
      }

      const shippingComplete = isAddressValid(savedDraft.shippingAddress);
      const billingComplete =
        savedDraft.sameAsShipping ||
        isAddressValid(savedDraft.billingAddress, { requireContact: false });
      const selectedDeliveryDate = savedDraft.selectedDeliveryDateIso
        ? new Date(savedDraft.selectedDeliveryDateIso)
        : undefined;
      const deliveryBaseDate = savedDraft.orderConfirmedDateIso
        ? new Date(savedDraft.orderConfirmedDateIso)
        : new Date();
      const extraLeadTimeDays = savedDraft.items.some(
        (item) => item.colour.type === "custom_dye"
      )
        ? CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS.max
        : 0;
      const deliveryComplete = isDeliverySelectionValid(
        savedDraft.deliveryType,
        selectedDeliveryDate,
        deliveryBaseDate,
        extraLeadTimeDays
      );

      if (!shippingComplete || !billingComplete || !deliveryComplete) {
        router.replace(`/configurator/cart/${encodeURIComponent(cartId)}/shipping`);
        return;
      }

      setDraft(savedDraft);
      setIsDraftReady(true);
    }, 0);

    return () => window.clearTimeout(loadDraft);
  }, [cartId, router]);

  const { subtotal, volumeDiscount, shippingFee, gst, delivery, orderTotal, balanceDue } =
    useMemo(() => {
      const totals = calculateTotals(draft.items, draft.deliveryType);
      return {
        subtotal: totals.subtotal,
        volumeDiscount: totals.volumeDiscount,
        shippingFee: totals.shippingFee,
        gst: totals.gst,
        delivery: formatDeliveryLabel(
          draft.deliveryType,
          draft.selectedDeliveryDateIso ? new Date(draft.selectedDeliveryDateIso) : undefined
        ),
        orderTotal: totals.total,
        balanceDue: totals.balanceDue,
      };
    }, [draft]);

  const billingAddress = draft.sameAsShipping ? draft.shippingAddress : draft.billingAddress;
  const projectContact = draft.shippingAddress;

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
      draft.sameAsShipping ||
      isAddressValid(draft.billingAddress, { requireContact: false });
    const selectedDeliveryDate = draft.selectedDeliveryDateIso
      ? new Date(draft.selectedDeliveryDateIso)
      : undefined;
    const deliveryBaseDate = draft.orderConfirmedDateIso
      ? new Date(draft.orderConfirmedDateIso)
      : new Date();
    const extraLeadTimeDays = draft.items.some((item) => item.colour.type === "custom_dye")
      ? CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS.max
      : 0;
    const deliveryComplete = isDeliverySelectionValid(
      draft.deliveryType,
      selectedDeliveryDate,
      deliveryBaseDate,
      extraLeadTimeDays
    );
    const firstname = projectContact.firstName.trim();
    const email = projectContact.email.trim();

    if (!hasValidItems || !shippingComplete || !billingComplete || !deliveryComplete) {
      setPaymentError(
        "Your order or company details are incomplete. Return to the previous steps and review them."
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
      const response = await fetch("/api/payu/hash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txnid, amount, productinfo, firstname, email }),
      });

      const payment = await response.json();
      if (
        !response.ok ||
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
          name: `${projectContact.firstName} ${projectContact.lastName}`.trim(),
          email,
          amount,
          product: draft.items.map((item) => item.productName).join(", "),
          color: draft.items.map((item) => item.colour.name || "Bright White").join(", "),
          technique: "Configurator order",
          placements: draft.items
            .map((item) =>
              [item.artwork.front?.fileUrl && "Front", item.artwork.back?.fileUrl && "Back"]
                .filter(Boolean)
                .join(" + ")
            )
            .filter(Boolean)
            .join(", "),
          neckLabel: draft.items.some((item) => item.neckLabel?.fileUrl)
            ? "Added"
            : "Not added",
          totalQty: draft.items.reduce(
            (sum, item) => sum + totalUnits(item.sizeQuantities),
            0
          ),
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
        window.location.assign(`/api/payu/callback?token=${encodeURIComponent(payment.udf1)}`);
        return;
      }

      const payuForm = document.createElement("form");
      payuForm.method = "POST";
      payuForm.action =
        process.env.NEXT_PUBLIC_PAYU_BASE_URL ??
        (process.env.NODE_ENV === "production"
          ? "https://secure.payu.in/_payment"
          : "https://test.payu.in/_payment");

      const fields: Record<string, string> = {
        key: payment.key,
        txnid,
        amount,
        productinfo: payment.productinfo,
        firstname,
        lastname: projectContact.lastName,
        email,
        phone: projectContact.phone,
        address1: billingAddress.addressLine1,
        city: billingAddress.city,
        state: billingAddress.state ?? "",
        zipcode: billingAddress.zip,
        country: billingAddress.country,
        hash: payment.hash,
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
      <div className="flex min-h-[320px] items-center justify-center" role="status" aria-live="polite">
        <LoaderCircle className="animate-spin text-[var(--color-teal)]" size={28} aria-hidden="true" />
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
            <p className="text-xs font-medium uppercase tracking-wide text-[#111111]/50">Cart {cartId}</p>
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

        <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#111111]">Shipping & project contact</h3>
            <button
              type="button"
              onClick={() => router.push(`/configurator/cart/${encodeURIComponent(cartId)}/shipping`)}
              className="text-xs text-[#111111]/70 underline hover:text-[#111111]"
            >
              Edit details
            </button>
          </div>
          <AddressSummary address={draft.shippingAddress} showContact />
          {(draft.shippingAddress.poNumber || draft.shippingAddress.orderNotes) && (
            <div className="mt-4 border-t border-[#E5E5E5] pt-3 text-xs text-[#111111]/65">
              {draft.shippingAddress.poNumber && <p><span className="font-medium">PO:</span> {draft.shippingAddress.poNumber}</p>}
              {draft.shippingAddress.orderNotes && <p className="mt-1"><span className="font-medium">Notes:</span> {draft.shippingAddress.orderNotes}</p>}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#111111]">Billing address</h3>
            {!draft.sameAsShipping && (
              <button
                type="button"
                onClick={() => router.push(`/configurator/cart/${encodeURIComponent(cartId)}/shipping`)}
                className="text-xs text-[#111111]/70 underline hover:text-[#111111]"
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

        <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
          <h3 className="mb-4 text-sm font-medium text-[#111111]">Order summary</h3>
          <div className="space-y-4">
            {draft.items.map((item) => <ProductRecapCard key={item.id} item={item} />)}
          </div>
        </section>

        <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
          <div className="flex items-start gap-3">
            <span className="rounded-full bg-[var(--color-teal)]/10 p-2 text-[var(--color-teal-dark)]">
              <CreditCard size={18} />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-[#111111]">Secure payment through PayU</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#111111]/60">
                Continue once to choose UPI, card or net banking on PayU. No payment-method selection is needed here.
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#111111]/65">
                <ShieldCheck size={14} className="text-[var(--color-teal-dark)]" />
                Your project is reviewed before production begins
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-[#111111]">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-teal)]"
            />
            I understand and agree to the reservation terms below
          </label>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-relaxed text-[#111111]/60">
            <li>{formatInr(RESERVATION_FEE)} reserves the production review and is charged today.</li>
            <li>The reservation fee is credited in full against the final invoice.</li>
            <li>The final invoice, including confirmed shipping, is shared after feasibility review.</li>
            <li>Production starts only after final approval and the agreed balance-payment terms.</li>
          </ul>
        </section>
      </div>

      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <CartSummarySidebar
          subtotal={subtotal}
          volumeDiscount={volumeDiscount}
          shippingFee={shippingFee}
          gst={gst}
          delivery={delivery}
          total={orderTotal}
          sticky={false}
        />
        <div className="rounded-lg border border-[var(--color-teal)]/25 bg-white p-5 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#111111]/50">Reservation payment</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <span className="font-medium text-[#111111]">Due today</span>
            <span className="text-2xl font-bold text-[var(--color-teal-dark)]">{formatInr(RESERVATION_FEE)}</span>
          </div>
          <div className="mt-3 flex justify-between border-t border-[#E5E5E5] pt-3 text-xs text-[#111111]/65">
            <span>Estimated balance later</span>
            <span className="font-semibold text-[#111111]">{formatInr(balanceDue)}</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[#111111]/60">
            Shipping and final production feasibility are confirmed by the Garmops team before the balance becomes payable.
          </p>
        </div>
        <button
          type="button"
          disabled={!termsAccepted || isProcessing}
          onClick={handlePayment}
          className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-colors ${
            termsAccepted && !isProcessing
              ? "bg-[var(--color-teal)] text-white hover:bg-[var(--color-teal-dark)]"
              : "cursor-not-allowed bg-[#E5E5E5] text-[#111111]/40"
          }`}
        >
          {isProcessing && <LoaderCircle size={16} className="animate-spin" />}
          {isProcessing
            ? "Opening secure payment…"
            : `Reserve production review — ${formatInr(RESERVATION_FEE)}`}
        </button>
        {!termsAccepted && (
          <p className="text-center text-xs text-[#111111]/55">Accept the reservation terms to continue.</p>
        )}
        {paymentError && <p role="alert" className="text-xs font-medium text-[#C62828]">{paymentError}</p>}
      </div>
    </div>
  );
}

function AddressSummary({ address, showContact = false }: { address: Address; showContact?: boolean }) {
  return (
    <div className="space-y-1 text-sm text-[#111111]/80">
      <p className="font-medium text-[#111111]">
        {address.firstName} {address.lastName}
        {address.company ? ` · ${address.company}` : ""}
      </p>
      <p>{address.addressLine1}</p>
      {address.addressLine2 && <p>{address.addressLine2}</p>}
      {address.gstin && <p>GSTIN: {address.gstin}</p>}
      <p>{address.city}{address.state ? `, ${address.state}` : ""} {address.zip}</p>
      <p>{address.country}</p>
      {showContact && (address.email || address.phone) && (
        <p className="pt-1 text-[#111111]/60">{[address.email, address.phone].filter(Boolean).join(" · ")}</p>
      )}
    </div>
  );
}

function ProductRecapCard({ item }: { item: CartItem }) {
  const units = totalUnits(item.sizeQuantities);
  const unitPrice = getCartItemUnitPrice(item);
  const discountPercent = getCartItemDiscountPercent(item);
  const productSizes = getProduct(item.productId)?.sizes ?? Object.keys(item.sizeQuantities);

  return (
    <div className="flex gap-4 rounded-lg border border-[#E5E5E5] p-4">
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
