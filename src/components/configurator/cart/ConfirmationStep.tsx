"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Tag,
} from "lucide-react";
import Link from "next/link";
import {
  isAddressValid,
  type Address,
} from "./AddressForm";
import { CartSummarySidebar } from "./CartSummarySidebar";
import {
  ConfiguratorTopBar,
  getCartProductLabel,
  getCartJourneyLinks,
} from "../ConfiguratorTopBar";
import { getProcurementMissingFields } from "./checkoutDetails";
import type { CartItem } from "./OrderReviewStep";
import {
  calculateTotals,
  clearPaidCart,
  createDraft,
  getCartItemDiscountPercent,
  getCartItemUnitPrice,
  readDraft,
  totalUnits,
  writeDraft,
} from "./cartDraft";
import {
  formatDeliveryLabel,
  getIndiaCalendarDate,
  isDeliverySelectionValid,
} from "@/lib/configurator/delivery";
import { formatInr } from "@/lib/configurator/pricing";
import { hasArtworkAsset } from "@/lib/configurator/pricing";
import { placementLabel } from "@/lib/configurator/artworkPlacement";
import { isCustomNeckLabel } from "@/lib/configurator/neckLabel";
import { calculateTaxPaise } from "@/lib/tax";
import { formatSpecCode } from "@/lib/orders/format";
import { getPaymentJourneyStep } from "@/lib/configurator/journey";
import {
  CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS,
  CUSTOM_DYE_MOQ_UNITS,
} from "@/lib/configurator/colourRules";
import { getProduct, getProductMinimumOrderQuantity } from "@/lib/configurator/products";
import CanvasRenderer from "../GarmentPreview/CanvasRenderer";
import ViewTabs from "../GarmentPreview/ViewTabs";
import { ArtworkPositionProvider } from "@/lib/configurator/ArtworkPositionContext";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";
import { ActionFeedback } from "../ActionFeedback";
import { prepareConfiguratorCheckoutPayment } from "@/lib/orders/client";

export interface ConfirmationStepProps {
  cartId: string;
  paymentOutcome?: "failure" | "pending";
  checkoutAttemptId?: string;
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

export function ConfirmationStep({
  cartId,
  paymentOutcome,
  checkoutAttemptId,
}: ConfirmationStepProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => createDraft(cartId));
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [verificationState, setVerificationState] = useState<"idle" | "pending" | "checking" | "failed" | "review">(
    paymentOutcome === "pending" ? "pending" : "idle",
  );
  const automaticRecheckStarted = useRef(false);
  const [promoState, setPromoState] = useState<
    | { status: "idle" }
    | { status: "checking" }
    | { status: "applied"; code: string; discountPaise: number; subtotalPaise: number }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const [paymentError, setPaymentError] = useState(() =>
    paymentOutcome === "failure"
      ? "The payment was not completed. No order was created. You can try again safely."
      : paymentOutcome === "pending"
        ? "PayU is still verifying this payment. Please wait before trying another payment."
        : "",
  );

  const recheckPayment = async () => {
    if (!checkoutAttemptId || verificationState === "checking") return;
    setVerificationState("checking");
    setPaymentError("Checking the verified payment status with PayU…");
    try {
      const response = await fetch("/api/payments/payu/recheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutAttemptId }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        outcome?: "success" | "failure" | "pending" | "needs_review";
        confirmationUrl?: string | null;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "Payment status could not be checked");
      if (body.outcome === "success" && body.confirmationUrl) {
        clearPaidCart(cartId);
        window.location.assign(body.confirmationUrl);
        return;
      }
      if (body.outcome === "failure") {
        setVerificationState("failed");
        setPaymentError("PayU confirmed that the previous payment was not completed. You can start a new payment safely.");
        return;
      }
      if (body.outcome === "needs_review") {
        setVerificationState("review");
        setPaymentError("We received an unusual payment status. Don't make another payment. Our payments team is reviewing it.");
        return;
      }
      setVerificationState("pending");
      setPaymentError("PayU is still verifying this payment. Do not start another payment yet; check again shortly.");
    } catch (error) {
      setVerificationState("pending");
      setPaymentError(error instanceof Error ? error.message : "Payment status could not be checked");
    }
  };

  useEffect(() => {
    if (paymentOutcome !== "pending" || !checkoutAttemptId || automaticRecheckStarted.current) return;
    automaticRecheckStarted.current = true;
    void recheckPayment();
    // One automatic verification is enough. The customer can explicitly recheck afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutAttemptId, paymentOutcome]);

  useEffect(() => {
    const loadDraft = window.setTimeout(() => {
      const savedDraft = readDraft(cartId);
      if (savedDraft.items.length === 0) {
        router.replace(`/configurator/cart/${encodeURIComponent(cartId)}/review`);
        return;
      }

      const procurementComplete =
        getProcurementMissingFields({
          contact: savedDraft.projectContact,
          shipping: savedDraft.shippingInformation,
          billing: savedDraft.billingInformation,
        }).length === 0;
      const selectedDeliveryDate = savedDraft.selectedDeliveryDateIso
        ? new Date(savedDraft.selectedDeliveryDateIso)
        : undefined;
      const deliveryBaseDate = getIndiaCalendarDate();
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


  const baseTotals = useMemo(
    () => calculateTotals(draft.items, draft.deliveryType),
    [draft.deliveryType, draft.items],
  );
  const normalizedPromoCode = draft.promoCode.trim().toUpperCase();
  const promoDiscountPaise =
    promoState.status === "applied" &&
    promoState.code === normalizedPromoCode &&
    promoState.subtotalPaise === baseTotals.taxableSubtotalPaise
      ? promoState.discountPaise
      : 0;
  const discountedTaxablePaise = Math.max(
    0,
    baseTotals.taxableSubtotalPaise - promoDiscountPaise,
  );
  const gstPaise = calculateTaxPaise(discountedTaxablePaise);
  const orderTotalPaise = discountedTaxablePaise + gstPaise;
  const subtotal = baseTotals.subtotal;
  const volumeDiscount = baseTotals.volumeDiscount;
  const rushFee = baseTotals.rushFee;
  const shippingFee = baseTotals.shippingFee;
  const promoDiscount = promoDiscountPaise / 100;
  const gst = gstPaise / 100;
  const orderTotal = orderTotalPaise / 100;
  const delivery = formatDeliveryLabel(
    draft.deliveryType,
    draft.selectedDeliveryDateIso
      ? new Date(draft.selectedDeliveryDateIso)
      : undefined,
  );

  const savedBillingAddress = draft.billingInformation.sameAsCompanyAddress
    ? draft.shippingInformation.address
    : draft.billingInformation.address;
  const billingAddress = isAddressValid(savedBillingAddress)
    ? savedBillingAddress
    : draft.shippingInformation.address;
  const projectContact = draft.projectContact;
  const billingEntity =
    draft.billingInformation.entity ||
    `${projectContact.firstName} ${projectContact.lastName}`.trim();
  const billingEmail =
    draft.billingInformation.accountsPayableEmail || projectContact.email;
  const billingUsesDeliveryAddress =
    joinAddress(billingAddress) ===
    joinAddress(draft.shippingInformation.address);

  const updatePromoCode = (value: string) => {
    const promoCode = value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
    setPromoState({ status: "idle" });
    setDraft((current) => {
      const next = { ...current, promoCode };
      writeDraft(cartId, next);
      return next;
    });
  };

  const validatePromoCode = async (): Promise<boolean> => {
    const code = draft.promoCode.trim().toUpperCase();
    if (!code) {
      setPromoState({ status: "idle" });
      return true;
    }

    if (
      promoState.status === "applied" &&
      promoState.code === code &&
      promoState.subtotalPaise === baseTotals.taxableSubtotalPaise
    ) {
      return true;
    }

    setPromoState({ status: "checking" });
    try {
      const response = await fetch("/api/orders/configurator/discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          subtotalPaise: baseTotals.taxableSubtotalPaise,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        discountPaise?: number;
      };
      if (
        !response.ok ||
        typeof body.code !== "string" ||
        typeof body.discountPaise !== "number"
      ) {
        setPromoState({
          status: "error",
          message: body.error ?? "Discount code is invalid or unavailable",
        });
        return false;
      }
      setPromoState({
        status: "applied",
        code: body.code,
        discountPaise: body.discountPaise,
        subtotalPaise: baseTotals.taxableSubtotalPaise,
      });
      return true;
    } catch {
      setPromoState({
        status: "error",
        message: "Discount code could not be checked. Try again.",
      });
      return false;
    }
  };

  const handlePayment = async () => {
    setPaymentError("");

    if (!termsAccepted) {
      setPaymentError("Accept the order terms and privacy notice before payment.");
      return;
    }

    const hasValidItems =
      draft.items.length > 0 &&
      draft.items.every((item) => {
        const minimum = getProductMinimumOrderQuantity(item.productId, { colourType: item.colour.type, customDyeMinimum: CUSTOM_DYE_MOQ_UNITS });
        return totalUnits(item.sizeQuantities) >= minimum;
      });
    const procurementMissing = getProcurementMissingFields({
      contact: draft.projectContact,
      shipping: draft.shippingInformation,
      billing: draft.billingInformation,
    });
    const selectedDeliveryDate = draft.selectedDeliveryDateIso
      ? new Date(draft.selectedDeliveryDateIso)
      : undefined;
    const deliveryBaseDate = getIndiaCalendarDate();
    const extraLeadTimeDays = draft.items.some((item) => item.colour.type === "custom_dye")
      ? CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS.max
      : 0;
    const deliveryComplete = isDeliverySelectionValid(
      draft.deliveryType,
      selectedDeliveryDate,
      deliveryBaseDate,
      extraLeadTimeDays
    );
    if (!hasValidItems || procurementMissing.length > 0 || !deliveryComplete) {
      trackConfiguratorEvent("checkout_validation_error", {
        cart_id: cartId,
        invalid_items: !hasValidItems,
        missing_fields: procurementMissing.length,
        delivery_incomplete: !deliveryComplete,
      });
      setPaymentError(
        "Your order or delivery details are incomplete. Return to the previous step and review them."
      );
      return;
    }

    if (!(await validatePromoCode())) {
      setPaymentError("Review or remove the discount code before payment.");
      return;
    }

    trackConfiguratorEvent("payment_started", {
      cart_id: cartId,
      amount: orderTotal,
      item_count: draft.items.length,
    });
    setIsProcessing(true);

    try {
      const result = await prepareConfiguratorCheckoutPayment({
        cartId,
        draft,
      });
      if (result.ok) {
        if (result.kind === "already_finalized") {
          trackConfiguratorEvent("durable_order_submitted", {
            cart_id: cartId,
            order_number: result.order.orderNumber,
          });
          clearPaidCart(cartId);
          window.location.assign(result.order.confirmationUrl);
        }
        return;
      }
      if (result.kind === "unauthorized") {
        window.location.assign(
          `/configurator/cart/${encodeURIComponent(cartId)}/confirmation`,
        );
        return;
      }

      setPaymentError(result.message);
      setIsProcessing(false);
      trackConfiguratorEvent("durable_order_failed", {
        cart_id: cartId,
        error: result.message,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Your order could not be created. Please try again.";
      setPaymentError(message);
      setIsProcessing(false);
      trackConfiguratorEvent("durable_order_failed", {
        cart_id: cartId,
        error: message,
      });
    }
  };

  const topBar = (
    <ConfiguratorTopBar
      currentStep={getPaymentJourneyStep(isProcessing)}
      backHref={
        isProcessing
          ? undefined
          : `/configurator/cart/${encodeURIComponent(cartId)}/shipping`
      }
      showCart
      productName={getCartProductLabel(draft.items)}
      specReference={`CART-${cartId}`}
      links={getCartJourneyLinks(
        cartId,
        draft.items[0]?.productId,
        draft.items[0]?.id
      )}
    />
  );

  if (!isDraftReady) {
    return (
      <>
        {topBar}
        <div className="flex min-h-[320px] items-center justify-center" role="status" aria-live="polite">
          <LoaderCircle className="animate-spin text-[var(--color-accent)]" size={28} aria-hidden="true" />
          <span className="sr-only">Validating contact and delivery details</span>
        </div>
      </>
    );
  }

  return (
    <>
      {topBar}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-[0.06em] text-[var(--text-primary)]/50">
              {formatSpecCode(`CART-${cartId}`)}
            </p>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Review your order
            </h1>
            <p className="mt-1 text-sm text-[var(--text-primary)]/55">
              Check your order, delivery details and total before payment.
            </p>
            {draft.projectName ? <p className="mt-2 text-xs font-medium text-[var(--text-primary)]/50">Project: {draft.projectName}</p> : null}
          </div>

        {paymentOutcome ? (
          <section className="techpack-panel rounded-[4px] border p-5" aria-live="polite">
            <div className="flex items-start gap-3">
              {paymentOutcome === "pending" ? <LoaderCircle className="mt-0.5 shrink-0 text-amber-700" size={20} aria-hidden="true" /> : <ShieldCheck className="mt-0.5 shrink-0 text-red-600" size={20} aria-hidden="true" />}
              <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">{paymentOutcome === "pending" ? "Confirming payment" : "Payment not completed"}</p>
                <h2 className="mt-1 text-lg font-semibold">{paymentOutcome === "pending" ? "We're confirming your payment" : "Payment wasn't completed"}</h2>
                <p className="mt-2 text-sm leading-relaxed text-black/55">{paymentOutcome === "pending" ? "PayU hasn't returned a final verified status yet. Don't make another payment while we check it." : "Your configuration is still saved. Review the details below before trying payment again."}</p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="techpack-panel rounded-[4px] border p-5">
          <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">01 / Your order</p>
          <h2 className="mb-4 text-sm font-medium text-[var(--text-primary)]">Configured products</h2>
          <div className="space-y-4">
            {draft.items.map((item, index) => <ProductRecapCard key={item.id} item={item} lineNumber={index + 1} cartId={cartId} />)}
          </div>
        </section>

        <ReviewSection
          index="02"
          icon={<MapPin size={18} />}
          title="Delivery & billing"
          onEdit={() => router.push(`/configurator/cart/${encodeURIComponent(cartId)}/shipping`)}
        >
          <div className="grid gap-5 text-sm text-[var(--text-primary)]/75 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-primary)]/45">
                Customer and contact
              </p>
              <p className="font-medium text-[var(--text-primary)]">
                {projectContact.firstName} {projectContact.lastName}
                {projectContact.department
                  ? ` · ${projectContact.department}`
                  : ""}
              </p>
              <p>{projectContact.email} · {projectContact.phone}</p>
              {draft.billingInformation.gstin && (
                <p className="text-xs text-[var(--text-primary)]/55">
                  GSTIN: {draft.billingInformation.gstin}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-primary)]/45">
                Delivery address
              </p>
              <p className="font-medium text-[var(--text-primary)]">
                {draft.shippingInformation.recipientName}
              </p>
              {draft.shippingInformation.company ? <p>{draft.shippingInformation.company}</p> : null}
              <AddressSummary address={draft.shippingInformation.address} />
              <p className="pt-1 text-xs text-[var(--text-primary)]/55">
                Target delivery date: {delivery}
              </p>
            </div>
            <div className="space-y-1 border-t border-[#E5E5E5] pt-4 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-primary)]/45">
                Billing
              </p>
              <p>
                <span className="font-medium text-[var(--text-primary)]">
                  {billingEntity}
                </span>{" "}
                · {billingEmail}
              </p>
              {draft.billingInformation.gstin ? <p className="text-xs text-[var(--text-primary)]/55">GSTIN: {draft.billingInformation.gstin}</p> : <p className="text-xs text-[var(--text-primary)]/55">Personal / non-GST customer</p>}
              {billingUsesDeliveryAddress ? (
                <p className="text-xs text-[var(--text-primary)]/55">
                  Billing address is the same as the delivery address.
                </p>
              ) : (
                <div className="pt-1">
                  <p className="mb-1 text-xs text-[var(--text-primary)]/55">
                    Alternate billing address
                  </p>
                  <AddressSummary address={billingAddress} />
                </div>
              )}
            </div>
          </div>
          {draft.shippingInformation.multipleLocations && (
            <div className="mt-4 rounded-[4px] bg-[#F7F7F7] p-3 text-xs leading-relaxed text-[var(--text-primary)]/65">
              <p className="font-medium text-[var(--text-primary)]">
                Multiple delivery locations requested
              </p>
              <p className="mt-1">
                {draft.shippingInformation.multipleLocationsNotes ||
                  "The detailed split and shipping charge still need confirmation."}
              </p>
            </div>
          )}

        </ReviewSection>

        {draft.projectPreferences.orderNotes && (
          <section className="techpack-panel rounded-[4px] border p-5">
            <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">Supplement / Project notes</p>
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Project notes & communication</h3>
            {draft.projectPreferences.orderNotes && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-primary)]/70">{draft.projectPreferences.orderNotes}</p>
            )}
          </section>
        )}

        <section className="techpack-panel rounded-[4px] border !border-[var(--color-accent)]/25 p-5">
          <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">03 / What happens next</p>
          <div className="flex items-start gap-3">
            <span className="rounded-[4px] bg-white p-2 text-[var(--color-accent-dark)]"><ShieldCheck size={18} /></span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">After payment</h3>
              <div className="mt-3 grid gap-2 text-xs leading-relaxed text-[var(--text-primary)]/65 sm:grid-cols-2">
                {[
                  "Payment confirmed",
                  "Artwork & production review",
                  "Production",
                  "Quality check",
                  "Dispatch & tracking",
                ].map((item) => (
                  <p key={item} className="flex items-start gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[var(--color-accent-dark)]" />{item}</p>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="techpack-panel rounded-[4px] border p-5">
          <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">04 / Payment authorisation</p>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
            />
            <span>I agree to the <Link href="/terms" className="underline">order terms</Link> and <Link href="/privacy" className="underline">privacy notice</Link>.</span>
          </label>
        </section>
        </div>

        <div className="space-y-4 lg:sticky lg:top-36 lg:self-start">
          <details className="techpack-panel rounded-[4px] border p-4">
            <summary className="flex cursor-pointer list-none items-center gap-2">
              <Tag size={16} className="text-[var(--color-accent)]" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">Have a discount code? +</span>
            </summary>
            <div className="mt-3 flex gap-2">
              <input
                value={draft.promoCode}
                onChange={(event) => updatePromoCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void validatePromoCode();
                  }
                }}
                placeholder="WELCOME10"
                className="techpack-control min-w-0 flex-1 rounded-[4px] border px-3 py-2 text-sm font-mono uppercase outline-none focus:!border-[var(--color-accent)]"
                maxLength={40}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => void validatePromoCode()}
                disabled={!draft.promoCode.trim() || promoState.status === "checking"}
                className="rounded-[4px] bg-black px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {promoState.status === "checking" ? "Checking…" : "Apply"}
              </button>
            </div>
            {promoState.status === "applied" ? (
              <p className="mt-2 text-xs font-medium text-emerald-700">
                {promoState.code} applied · save {formatInr(promoState.discountPaise / 100)}
              </p>
            ) : promoState.status === "error" ? (
              <p className="mt-2 text-xs text-red-600">{promoState.message}</p>
            ) : (
              <p className="mt-2 text-xs text-[var(--text-primary)]/45">
                Codes are checked against your account and current order value.
              </p>
            )}
          </details>
          <CartSummarySidebar
            subtotal={subtotal}
            volumeDiscount={volumeDiscount}
            rushFee={rushFee}
            promoDiscount={promoDiscount}
            shippingFee={shippingFee}
            gst={gst}
            delivery={delivery}
            total={orderTotal}
            sticky={false}
          />
          <button
            type="button"
            disabled={!termsAccepted || isProcessing || verificationState === "pending" || verificationState === "checking" || verificationState === "review" || promoState.status === "checking"}
            onClick={handlePayment}
            className={`flex w-full items-center justify-center gap-2 rounded-[4px] py-3 text-sm font-semibold transition-colors ${
              termsAccepted && !isProcessing && verificationState !== "pending" && verificationState !== "checking" && verificationState !== "review" && promoState.status !== "checking"
                ? "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-dark)]"
                : "cursor-not-allowed bg-[#E5E5E5] text-[var(--text-primary)]/40"
            }`}
          >
            {isProcessing && <LoaderCircle size={16} className="animate-spin" />}
            {isProcessing
              ? "Opening secure payment…"
              : `Pay ${formatInr(orderTotal)} securely →`}
          </button>
          {!termsAccepted && (
            <p className="text-center text-xs text-[var(--text-primary)]/55">Accept the order terms to continue.</p>
          )}
          {paymentError && <ActionFeedback tone={verificationState === "pending" || verificationState === "checking" || verificationState === "review" ? "info" : "error"} title={verificationState === "review" ? "Payment needs review" : verificationState === "pending" || verificationState === "checking" ? "We're confirming your payment" : "Payment wasn't completed"} detail={`${paymentError} Your configuration is still saved.`} actionLabel={verificationState === "pending" ? (checkoutAttemptId ? "Check payment status" : undefined) : verificationState === "checking" || verificationState === "review" ? undefined : "Try payment again"} onAction={verificationState === "pending" ? (checkoutAttemptId ? recheckPayment : undefined) : verificationState === "checking" || verificationState === "review" ? undefined : handlePayment} onDismiss={verificationState === "review" ? undefined : () => setPaymentError("")} />}
        </div>
      </div>
    </>
  );
}

function ReviewSection({
  index,
  icon,
  title,
  onEdit,
  children,
}: {
  index: string;
  icon: ReactNode;
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className="techpack-panel rounded-[4px] border p-5">
      <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
        {index} / Review section
      </p>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-accent-dark)]">{icon}</span>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-[var(--text-primary)]/70 underline hover:text-[var(--text-primary)]"
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
    <div className="space-y-1 text-sm text-[var(--text-primary)]/75">
      <p>{address.addressLine1}</p>
      {address.addressLine2 && <p>{address.addressLine2}</p>}
      <p>{address.city}{address.state ? `, ${address.state}` : ""} {address.zip}</p>
      <p>{address.country}</p>
    </div>
  );
}

function ProductRecapCard({ item, lineNumber, cartId }: { item: CartItem; lineNumber: number; cartId: string }) {
  const [view, setView] = useState<"front" | "back" | "neck">("front");
  const units = totalUnits(item.sizeQuantities);
  const unitPrice = getCartItemUnitPrice(item);
  const discountPercent = getCartItemDiscountPercent(item);
  const productSizes = getProduct(item.productId)?.sizes ?? Object.keys(item.sizeQuantities);

  return (
    <article className="techpack-control rounded-[4px] border p-4">
      <div className="grid gap-6 sm:grid-cols-[176px_minmax(0,1fr)] sm:gap-8">
      <div className="min-w-0">
        <div className="aspect-[4/5] w-full max-w-[132px] overflow-hidden rounded-[4px] bg-[#F7F7F7]">
        <ArtworkPositionProvider activeView={view}>
          <CanvasRenderer
            view={view}
            colourHex={item.colour.hex}
            productId={item.productId}
            artwork={item.artwork}
            neckLabel={item.neckLabel}
            interactive={false}
            className="h-full w-full scale-[0.9] bg-[#F7F7F7]"
          />
        </ArtworkPositionProvider>
        </div>
        <div className="mt-3 overflow-x-auto pb-1"><ViewTabs activeView={view} onChange={setView} productId={item.productId} idPrefix={`review-line-${lineNumber}`} /></div>
      </div>
      <div className="min-w-0">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">Line {lineNumber}</p>
        <p className="text-sm font-medium text-[var(--text-primary)]">{item.productName}</p>
        <p className="text-xs text-[var(--text-primary)]/60">
          {item.colour.name || "Bright White"} · <span className="font-mono">{units} pieces · {formatInr(unitPrice)}/unit</span>
          {discountPercent > 0 ? ` · ${discountPercent}% off` : ""}
        </p>
        <div className="mt-4 grid gap-3 text-xs text-[var(--text-primary)]/65 sm:grid-cols-2">
          <ArtworkSummary label="Front" side={item.artwork.front} />
          <ArtworkSummary label="Back" side={item.artwork.back} />
          <div><p className="font-semibold text-[var(--text-primary)]">Neck label</p><p className="mt-1">{isCustomNeckLabel(item.neckLabel) ? `Custom · ${item.neckLabel?.dimensions.replace("x", " × ")} mm` : "Standard size label"}</p></div>
          <div><p className="font-semibold text-[var(--text-primary)]">Line total</p><p className="mt-1 font-mono">{formatInr(unitPrice * units)}</p></div>
        </div>
        <div className="mt-4"><p className="text-xs font-semibold text-[var(--text-primary)]">Sizes</p><div className="mt-2 flex flex-wrap gap-2">{productSizes.filter((size) => (item.sizeQuantities[size] ?? 0) > 0).map((size) => <span key={size} className="rounded-[3px] border border-black/8 px-2 py-1 text-xs">{size} {item.sizeQuantities[size]}</span>)}</div></div>
        <Link href={`/configurator/build/${encodeURIComponent(item.productId)}?cartId=${encodeURIComponent(cartId)}&itemId=${encodeURIComponent(item.id)}`} className="mt-4 inline-block text-xs font-semibold text-[var(--color-accent-dark)] underline">Edit configuration →</Link>
      </div>
      </div>
    </article>
  );
}

function ArtworkSummary({ label, side }: { label: string; side: CartItem["artwork"]["front"] }) {
  const present = hasArtworkAsset(side);
  const technique = side?.technique
    ? side.technique.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Technique to confirm";
  return <div><p className="font-semibold text-[var(--text-primary)]">{label}</p><p className="mt-1">{present ? `${technique} · ${placementLabel(side?.placementPreset)}` : "No artwork"}</p></div>;
}
