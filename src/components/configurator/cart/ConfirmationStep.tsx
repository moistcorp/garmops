"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  MapPin,
  ShieldCheck,
} from "lucide-react";
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
  createDraft,
  getCartItemDiscountPercent,
  getCartItemUnitPrice,
  readDraft,
  totalUnits,
} from "./cartDraft";
import { formatDeliveryLabel, isDeliverySelectionValid } from "@/lib/configurator/delivery";
import { formatInr } from "@/lib/configurator/pricing";
import { formatSpecCode } from "@/lib/orders/format";
import { getPaymentJourneyStep } from "@/lib/configurator/journey";
import {
  CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS,
  CUSTOM_DYE_MOQ_UNITS,
} from "@/lib/configurator/colourRules";
import { getProduct } from "@/lib/configurator/products";
import CanvasRenderer from "../GarmentPreview/CanvasRenderer";
import { ArtworkPositionProvider } from "@/lib/configurator/ArtworkPositionContext";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";
import { ActionFeedback } from "../ActionFeedback";
import { prepareCustomCheckoutPayment } from "@/lib/orders/client";

export interface ConfirmationStepProps {
  cartId: string;
  paymentOutcome?: "failure" | "pending";
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
}: ConfirmationStepProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => createDraft(cartId));
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState(() =>
    paymentOutcome === "failure"
      ? "The payment was not completed. No order was created. You can try again safely."
      : paymentOutcome === "pending"
        ? "PayU is still verifying this payment. Please wait before trying another payment."
        : "",
  );

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


  const { subtotal, volumeDiscount, shippingFee, gst, delivery, orderTotal } =
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
      };
    }, [draft]);

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

  const handlePayment = async () => {
    setPaymentError("");

    const hasValidItems =
      draft.items.length > 0 &&
      draft.items.every((item) => {
        const minimum = item.colour.type === "custom_dye" ? CUSTOM_DYE_MOQ_UNITS : 50;
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

    trackConfiguratorEvent("payment_started", {
      cart_id: cartId,
      amount: orderTotal,
      item_count: draft.items.length,
    });
    setIsProcessing(true);

    try {
      const result = await prepareCustomCheckoutPayment({
        cartId,
        draft,
      });
      if (result.ok) {
        if (result.kind === "already_finalized") {
          trackConfiguratorEvent("durable_order_submitted", {
            cart_id: cartId,
            order_number: result.order.orderNumber,
          });
          window.location.assign(result.order.confirmationUrl);
        }
        return;
      }
      if (result.kind === "unauthorized") {
        router.push(
          `/login?next=${encodeURIComponent(`/configurator/cart/${cartId}/confirmation`)}`,
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
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-primary)]/50">
              {formatSpecCode(`CART-${cartId}`)}
            </p>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Review &amp; payment
            </h1>
            {draft.projectName && (
              <p className="mt-1 text-sm font-medium text-[var(--text-primary)]/60">
                {draft.projectName}
              </p>
            )}
          </div>

        <ReviewSection
          index="01"
          icon={<MapPin size={18} />}
          title="Delivery and billing details"
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
                  "The detailed split and shipping charge will be confirmed by our operations team."}
              </p>
            </div>
          )}

        </ReviewSection>

        {(draft.projectPreferences.orderNotes || draft.projectPreferences.receiveEmails) && (
          <section className="techpack-panel rounded-[4px] border p-5">
            <p className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">Supplement / Project notes</p>
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Project notes & communication</h3>
            {draft.projectPreferences.orderNotes && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-primary)]/70">{draft.projectPreferences.orderNotes}</p>
            )}
            {draft.projectPreferences.receiveEmails && (
              <p className="mt-2 text-xs text-[var(--text-primary)]/50">Marketing and product updates enabled.</p>
            )}
          </section>
        )}

        <section className="techpack-panel rounded-[4px] border p-5">
          <p className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">02 / Order specification</p>
          <h3 className="mb-4 text-sm font-medium text-[var(--text-primary)]">Order summary</h3>
          <div className="space-y-4">
            {draft.items.map((item) => <ProductRecapCard key={item.id} item={item} />)}
          </div>
        </section>

        <section className="techpack-panel rounded-[4px] border !border-[var(--color-accent)]/25 p-5">
          <p className="mb-3 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">03 / Production handoff</p>
          <div className="flex items-start gap-3">
            <span className="rounded-[4px] bg-white p-2 text-[var(--color-accent-dark)]"><ShieldCheck size={18} /></span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">What happens after payment?</h3>
              <div className="mt-3 grid gap-2 text-xs leading-relaxed text-[var(--text-primary)]/65 sm:grid-cols-2">
                {[
                  "A merch specialist checks artwork and production feasibility.",
                  "Shipping is reviewed separately and a PayU shipping-payment link is shared by staff.",
                  "Production starts after artwork approval and operational review.",
                ].map((item) => (
                  <p key={item} className="flex items-start gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[var(--color-accent-dark)]" />{item}</p>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-accent)]/20 pt-3 text-xs font-medium text-[var(--text-primary)]/65">
                <CreditCard size={15} className="text-[var(--color-accent-dark)]" />
                Your order is created only after PayU verifies the complete merchandise payment.
              </div>
            </div>
          </div>
        </section>

        <section className="techpack-panel rounded-[4px] border p-5">
          <p className="mb-3 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">04 / Payment authorisation</p>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
            />
            I agree to the order terms, privacy notice and full merchandise payment shown in this checkout.
          </label>
          <p className="mt-3 text-xs leading-relaxed text-[var(--text-primary)]/60">
            The amount paid now includes the configured merchandise and 5% GST. Shipping is excluded and will be quoted separately by our operations team through a secure PayU payment link.
          </p>
        </section>
        </div>

        <div className="space-y-4 lg:sticky lg:top-36 lg:self-start">
          <CartSummarySidebar
            subtotal={subtotal}
            volumeDiscount={volumeDiscount}
            shippingFee={shippingFee}
            gst={gst}
            delivery={delivery}
            total={orderTotal}
            sticky={false}
          />
          <button
            type="button"
            disabled={!termsAccepted || isProcessing}
            onClick={handlePayment}
            className={`flex w-full items-center justify-center gap-2 rounded-[4px] py-3 text-sm font-semibold transition-colors ${
              termsAccepted && !isProcessing
                ? "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-dark)]"
                : "cursor-not-allowed bg-[#E5E5E5] text-[var(--text-primary)]/40"
            }`}
          >
            {isProcessing && <LoaderCircle size={16} className="animate-spin" />}
            {isProcessing
              ? "Opening secure PayU checkout…"
              : `Pay full amount — ${formatInr(orderTotal)}`}
          </button>
          {!termsAccepted && (
            <p className="text-center text-xs text-[var(--text-primary)]/55">Accept the order terms to continue.</p>
          )}
          {paymentError && <ActionFeedback tone="error" title="Order payment" detail={`${paymentError} Your configurator details are safe.`} actionLabel={paymentError.includes("still verifying") ? undefined : "Try payment again"} onAction={paymentError.includes("still verifying") ? undefined : handlePayment} onDismiss={() => setPaymentError("")} />}
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
      <p className="mb-3 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
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

function ProductRecapCard({ item }: { item: CartItem }) {
  const units = totalUnits(item.sizeQuantities);
  const unitPrice = getCartItemUnitPrice(item);
  const discountPercent = getCartItemDiscountPercent(item);
  const productSizes = getProduct(item.productId)?.sizes ?? Object.keys(item.sizeQuantities);

  return (
    <div className="techpack-control flex gap-4 rounded-[4px] border p-4">
      <div className="h-24 w-20 shrink-0 overflow-hidden rounded-[4px] bg-[#F7F7F7]">
        <ArtworkPositionProvider activeView="front">
          <CanvasRenderer
            view="front"
            colourHex={item.colour.hex}
            productId={item.productId}
            artwork={item.artwork}
            neckLabel={item.neckLabel}
            interactive={false}
            className="h-full w-full scale-[0.82] bg-[#F7F7F7]"
          />
        </ArtworkPositionProvider>
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--text-primary)]">{item.productName}</p>
        <p className="text-xs text-[var(--text-primary)]/60">
          {item.colour.name || "Bright White"} · <span className="font-mono">{units} units · {formatInr(unitPrice)}/unit</span>
          {discountPercent > 0 ? ` · ${discountPercent}% off` : ""}
        </p>
        <div
          className="mt-2 grid gap-1 text-[10px] text-[var(--text-primary)]/60"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, productSizes.length)}, minmax(0, 1fr))` }}
        >
          {productSizes.map((size) => (
            <div key={size} className="text-center">
              <div className="font-medium text-[var(--text-primary)]">{size}</div>
              <div>{item.sizeQuantities[size] ?? 0}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
