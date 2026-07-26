"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  LoaderCircle,
  MapPin,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { Address } from "./AddressForm";
import { CartSummarySidebar } from "./CartSummarySidebar";
import { CheckoutSteps } from "./CheckoutSteps";
import { getProcurementMissingFields } from "./checkoutDetails";
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
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";
import { ActionFeedback } from "../ActionFeedback";

export interface ConfirmationStepProps {
  cartId: string;
}

function joinAddress(address: Address): string {
  return [
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.state,
    address.zip,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
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

      const procurementComplete =
        getProcurementMissingFields({
          company: savedDraft.companyInformation,
          contact: savedDraft.projectContact,
          shipping: savedDraft.shippingInformation,
          billing: savedDraft.billingInformation,
        }).length === 0;
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

      if (!procurementComplete || !deliveryComplete) {
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

  const billingAddress = draft.billingInformation.sameAsCompanyAddress
    ? draft.companyInformation.address
    : draft.billingInformation.address;
  const projectContact = draft.projectContact;

  const handlePayment = async () => {
    setPaymentError("");

    const hasValidItems =
      draft.items.length > 0 &&
      draft.items.every((item) => {
        const minimum = item.colour.type === "custom_dye" ? CUSTOM_DYE_MOQ_UNITS : 50;
        return totalUnits(item.sizeQuantities) >= minimum;
      });
    const procurementMissing = getProcurementMissingFields({
      company: draft.companyInformation,
      contact: draft.projectContact,
      shipping: draft.shippingInformation,
      billing: draft.billingInformation,
    });
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

    if (!hasValidItems || procurementMissing.length > 0 || !deliveryComplete) {
      trackConfiguratorEvent("checkout_validation_error", {
        cart_id: cartId,
        invalid_items: !hasValidItems,
        missing_fields: procurementMissing.length,
        delivery_incomplete: !deliveryComplete,
      });
      setPaymentError(
        "Your order or company details are incomplete. Return to the previous step and review them."
      );
      return;
    }

    trackConfiguratorEvent("payment_started", {
      cart_id: cartId,
      reservation_fee: RESERVATION_FEE,
      item_count: draft.items.length,
    });
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

      const shippingAddress = draft.shippingInformation.address;
      const purchaseOrder = draft.billingInformation.purchaseOrder;
      window.localStorage.setItem(
        "mf_pending_order",
        JSON.stringify({
          kind: "configurator",
          mockPayment: Boolean(payment.mockPayment),
          txnid,
          name: `${projectContact.firstName} ${projectContact.lastName}`.trim(),
          email,
          amount,
          projectName: draft.projectName,
          companyName: draft.companyInformation.name,
          companyGstin: draft.companyInformation.gstin,
          companyWebsite: draft.companyInformation.website,
          industry: draft.companyInformation.industry,
          department: projectContact.department,
          phone: projectContact.phone,
          billingEntity: draft.billingInformation.entity,
          accountsPayableEmail: draft.billingInformation.accountsPayableEmail,
          billingGstin: draft.billingInformation.gstin,
          billingAddress: joinAddress(billingAddress),
          poNumber: draft.companyInformation.poNumber,
          costCentre: draft.companyInformation.costCentre,
          poFileKey: purchaseOrder?.fileKey,
          poFileName: purchaseOrder?.fileName,
          poFileType: purchaseOrder?.fileType,
          orderNotes: draft.projectPreferences.orderNotes,
          multipleLocations: draft.shippingInformation.multipleLocations,
          multipleLocationsNotes: draft.shippingInformation.multipleLocationsNotes,
          targetDelivery: delivery,
          product: draft.items.map((item) => item.productName).join(", "),
          color: draft.items.map((item) => item.colour.name || "Bright White").join(", "),
          technique: draft.items
            .flatMap((item) => [item.artwork.front?.technique, item.artwork.back?.technique])
            .filter(Boolean)
            .join(", ") || "To be reviewed",
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
              return `${item.productName}: ${sizes
                .map((size) => `${size}: ${item.sizeQuantities[size] ?? 0}`)
                .join(", ")}`;
            })
            .join(" | "),
          estimatedTotal: formatInr(orderTotal),
          retryHref: `/configurator/cart/${encodeURIComponent(cartId)}/confirmation`,
          shipping: {
            recipientName: draft.shippingInformation.recipientName,
            addressLine1: shippingAddress.addressLine1,
            addressLine2: shippingAddress.addressLine2,
            city: shippingAddress.city,
            state: shippingAddress.state,
            pincode: shippingAddress.zip,
            country: shippingAddress.country,
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
        address2: billingAddress.addressLine2 ?? "",
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
      trackConfiguratorEvent("payment_failed", { cart_id: cartId, error: error instanceof Error ? error.message : "unknown" });
    }
  };

  if (!isDraftReady) {
    return (
      <div className="flex min-h-[320px] items-center justify-center" role="status" aria-live="polite">
        <LoaderCircle className="animate-spin text-[var(--color-teal)]" size={28} aria-hidden="true" />
        <span className="sr-only">Validating company, billing and shipping details</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <CheckoutSteps currentStep="payment" cartId={cartId} firstProductId={draft.items[0]?.productId} firstItemId={draft.items[0]?.id} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#111111]/50">Cart {cartId}</p>
            <h1 className="text-2xl font-semibold text-[#111111]">Review & Payment</h1>
            {draft.projectName && <p className="mt-1 text-sm font-medium text-[#111111]/60">{draft.projectName}</p>}
          </div>
          <button
            type="button"
            onClick={() => router.push(`/configurator/cart/${encodeURIComponent(cartId)}/shipping`)}
            className="inline-flex items-center gap-2 self-start rounded-full border border-[#E5E5E5] px-4 py-2 text-sm font-medium text-[#111111]/75 hover:border-[var(--color-teal)] hover:text-[#111111] sm:self-auto"
          >
            <ArrowLeft size={16} strokeWidth={2.2} />
            Back to Company, Billing & Shipping
          </button>
        </div>

        <ReviewSection
          icon={<Building2 size={18} />}
          title="Company information"
          onEdit={() => router.push(`/configurator/cart/${encodeURIComponent(cartId)}/shipping#company-information`)}
        >
          <div className="grid gap-1 text-sm text-[#111111]/75 sm:grid-cols-2">
            <p><span className="font-medium text-[#111111]">Company:</span> {draft.companyInformation.name}</p>
            <p><span className="font-medium text-[#111111]">Industry:</span> {draft.companyInformation.industry}</p>
            {draft.companyInformation.gstin && <p><span className="font-medium text-[#111111]">GSTIN:</span> {draft.companyInformation.gstin}</p>}
            {draft.companyInformation.website && <p><span className="font-medium text-[#111111]">Website:</span> {draft.companyInformation.website}</p>}
            {draft.companyInformation.poNumber && <p><span className="font-medium text-[#111111]">PO number:</span> {draft.companyInformation.poNumber}</p>}
            {draft.companyInformation.costCentre && <p><span className="font-medium text-[#111111]">Cost centre:</span> {draft.companyInformation.costCentre}</p>}
          </div>
        </ReviewSection>

        <ReviewSection
          icon={<UserRound size={18} />}
          title="Primary project contact"
          onEdit={() => router.push(`/configurator/cart/${encodeURIComponent(cartId)}/shipping#project-contact`)}
        >
          <div className="space-y-1 text-sm text-[#111111]/75">
            <p className="font-medium text-[#111111]">{projectContact.firstName} {projectContact.lastName}</p>
            <p>{projectContact.department}</p>
            <p>{projectContact.email} · {projectContact.phone}</p>
          </div>
        </ReviewSection>

        <ReviewSection
          icon={<MapPin size={18} />}
          title="Shipping information"
          onEdit={() => router.push(`/configurator/cart/${encodeURIComponent(cartId)}/shipping#shipping-information`)}
        >
          <p className="mb-1 text-sm font-medium text-[#111111]">{draft.shippingInformation.recipientName}</p>
          <AddressSummary address={draft.shippingInformation.address} />
          {draft.shippingInformation.multipleLocations && (
            <div className="mt-3 rounded-md bg-[#F7F7F7] p-3 text-xs leading-relaxed text-[#111111]/65">
              <p className="font-medium text-[#111111]">Multiple delivery locations requested</p>
              <p className="mt-1">{draft.shippingInformation.multipleLocationsNotes || "Detailed split will be confirmed after reservation."}</p>
            </div>
          )}
          <p className="mt-3 text-xs text-[#111111]/55">Target delivery: {delivery}</p>
        </ReviewSection>

        <ReviewSection
          icon={<ReceiptText size={18} />}
          title="Billing information"
          onEdit={() => router.push(`/configurator/cart/${encodeURIComponent(cartId)}/shipping#billing-information`)}
        >
          <div className="space-y-1 text-sm text-[#111111]/75">
            <p className="font-medium text-[#111111]">{draft.billingInformation.entity}</p>
            <p>Accounts payable: {draft.billingInformation.accountsPayableEmail}</p>
            {draft.billingInformation.gstin && <p>GSTIN: {draft.billingInformation.gstin}</p>}
            <p className="pt-1 text-xs text-[#111111]/55">
              {draft.billingInformation.sameAsCompanyAddress
                ? "Registered company / billing address:"
                : "Alternate billing address:"}
            </p>
            <AddressSummary address={billingAddress} />
          </div>
          {draft.billingInformation.purchaseOrder && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-[#F7F7F7] p-3 text-xs text-[#111111]/65">
              <FileText size={16} className="shrink-0 text-[var(--color-teal-dark)]" />
              <span>Purchase order attached: <strong className="text-[#111111]">{draft.billingInformation.purchaseOrder.fileName}</strong></span>
            </div>
          )}
        </ReviewSection>

        {(draft.projectPreferences.orderNotes || draft.projectPreferences.receiveEmails) && (
          <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
            <h3 className="text-sm font-medium text-[#111111]">Project notes & communication</h3>
            {draft.projectPreferences.orderNotes && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#111111]/70">{draft.projectPreferences.orderNotes}</p>
            )}
            {draft.projectPreferences.receiveEmails && (
              <p className="mt-2 text-xs text-[#111111]/50">Marketing and product updates enabled.</p>
            )}
          </section>
        )}

        <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
          <h3 className="mb-4 text-sm font-medium text-[#111111]">Order summary</h3>
          <div className="space-y-4">
            {draft.items.map((item) => <ProductRecapCard key={item.id} item={item} />)}
          </div>
        </section>

        <section className="rounded-lg border border-[var(--color-teal)]/25 bg-[var(--color-teal)]/5 p-5">
          <div className="flex items-start gap-3">
            <span className="rounded-full bg-white p-2 text-[var(--color-teal-dark)]"><ShieldCheck size={18} /></span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-[#111111]">What happens after reservation?</h3>
              <div className="mt-3 grid gap-2 text-xs leading-relaxed text-[#111111]/65 sm:grid-cols-2">
                {[
                  "A merch specialist checks artwork and production feasibility.",
                  "Final pricing and shipping are confirmed before the balance is due.",
                  `${formatInr(RESERVATION_FEE)} is credited in full against the final invoice.`,
                  "Production starts only after your final approval and agreed payment terms.",
                ].map((item) => (
                  <p key={item} className="flex items-start gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[var(--color-teal-dark)]" />{item}</p>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-teal)]/20 pt-3 text-xs font-medium text-[#111111]/65">
                <CreditCard size={15} className="text-[var(--color-teal-dark)]" />
                Secure payment through PayU using UPI, card or net banking.
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
        {paymentError && <ActionFeedback tone="error" title="Payment could not be opened" detail={`${paymentError} Your project details are safe.`} actionLabel="Try payment again" onAction={handlePayment} onDismiss={() => setPaymentError("")} />}
      </div>
    </div>
  );
}

function ReviewSection({
  icon,
  title,
  onEdit,
  children,
}: {
  icon: ReactNode;
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#E5E5E5] bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-teal-dark)]">{icon}</span>
          <h3 className="text-sm font-medium text-[#111111]">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-[#111111]/70 underline hover:text-[#111111]"
        >
          Edit details
        </button>
      </div>
      {children}
    </section>
  );
}

function AddressSummary({ address }: { address: Address }) {
  return (
    <div className="space-y-1 text-sm text-[#111111]/75">
      <p>{address.addressLine1}</p>
      {address.addressLine2 && <p>{address.addressLine2}</p>}
      <p>{address.city}{address.state ? `, ${address.state}` : ""} {address.zip}</p>
      <p>{address.country}</p>
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
