"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCartStore } from "@/lib/store";
import type { PaymentKind } from "@/lib/payu";
import { readUploadedFile } from "@/lib/configurator/objectUrls";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";
import { ConfiguratorTopBar } from "@/components/configurator/ConfiguratorTopBar";

interface PaymentSuccessClientProps {
  verified: boolean;
  txnid: string;
  paymentKind: PaymentKind | null;
  isMockPayment: boolean;
}

type EmailStatus = "idle" | "sending" | "sent" | "failed" | "skipped";
type OrderDetailsStatus = "checking" | "found" | "missing";

type PendingOrder = {
  kind?: PaymentKind;
  mockPayment?: boolean;
  name?: string;
  email?: string;
  txnid?: string;
  amount?: string;
  projectName?: string;
  companyName?: string;
  companyGstin?: string;
  companyWebsite?: string;
  industry?: string;
  department?: string;
  phone?: string;
  billingEntity?: string;
  accountsPayableEmail?: string;
  billingGstin?: string;
  billingAddress?: string;
  poNumber?: string;
  costCentre?: string;
  poFileKey?: string;
  poFileName?: string;
  poFileType?: string;
  orderNotes?: string;
  multipleLocations?: boolean;
  multipleLocationsNotes?: string;
  targetDelivery?: string;
  product?: string;
  color?: string;
  technique?: string;
  placements?: string;
  neckLabel?: string;
  totalQty?: number;
  sizeBreakdown?: string;
  estimatedTotal?: string;
  retryHref?: string;
  shippingAddress?: string;
  items?: Array<{
    name?: string;
    size?: string;
    quantity?: number;
    lineTotal?: number;
  }>;
  shipping?: {
    recipientName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
};
export default function PaymentSuccessClient({
  verified,
  txnid,
  paymentKind,
  isMockPayment,
}: PaymentSuccessClientProps) {
  const hasHandled = useRef(false);
  const clearCart = useCartStore((state) => state.clearCart);
  const [orderSummary, setOrderSummary] = useState({ name: "", email: "" });
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [orderDetailsStatus, setOrderDetailsStatus] =
    useState<OrderDetailsStatus>("checking");

  useEffect(() => {
    if (!verified || hasHandled.current) return;
    hasHandled.current = true;

    // A verified sample-cart payment means this browser cart should no longer
    // remain purchasable, even when its optional local order summary is missing.
    if (paymentKind === "sample-cart") {
      clearCart();
    }

    let order: PendingOrder | null = null;
    try {
      const raw = window.localStorage.getItem("mf_pending_order");
      if (raw) {
        const parsed = JSON.parse(raw) as PendingOrder;
        if (parsed.txnid === txnid) order = parsed;
      }
    } catch {
      order = null;
    }

    if (!order) {
      if (paymentKind === "configurator") {
        trackConfiguratorEvent("reservation_completed", {
          transaction_id: txnid,
          order_details_restored: false,
          mock_payment: isMockPayment,
        });
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrderDetailsStatus("missing");
      return;
    }

    if (paymentKind === "configurator") {
      trackConfiguratorEvent("reservation_completed", {
        transaction_id: txnid,
        order_details_restored: true,
        mock_payment: isMockPayment,
        quantity: order.totalQty,
      });
    }

    setOrderDetailsStatus("found");

    // One-time hydration from localStorage on mount, guarded by hasHandled
    // above — not a derived/cascading update, so the lint rule's general
    // "don't setState in an effect" guidance doesn't apply here.
    setOrderSummary({
      name: order.name ?? "",
      email: order.email ?? "",
    });

    if (isMockPayment) {
      window.localStorage.removeItem("mf_pending_order");
      setEmailStatus("skipped");
      return;
    }

    if (!order.name || !order.email) {
      setEmailStatus("failed");
      return;
    }

    const isSampleOrder = paymentKind === "sample-cart";
    setEmailStatus("sending");

    void (async () => {
      const shippingAddress = order.shipping
        ? [
            order.shipping.recipientName,
            order.shipping.addressLine1,
            order.shipping.addressLine2,
            order.shipping.city,
            order.shipping.state,
            order.shipping.pincode,
            order.shipping.country,
          ]
            .filter(Boolean)
            .join(", ")
        : "";
      const payload = {
        name: order.name,
        email: order.email,
        txnid,
        type: isSampleOrder ? "sample" : "configure",
        paymentStatus: "success",
        orderDetails: isSampleOrder
          ? {
              items: order.items ?? [],
              estimatedTotal: order.amount ? `₹${order.amount}` : "",
              shippingAddress: order.shippingAddress ?? "",
            }
          : {
              projectName: order.projectName,
              companyName: order.companyName,
              companyGstin: order.companyGstin,
              companyWebsite: order.companyWebsite,
              industry: order.industry,
              department: order.department,
              phone: order.phone,
              billingEntity: order.billingEntity,
              accountsPayableEmail: order.accountsPayableEmail,
              billingGstin: order.billingGstin,
              billingAddress: order.billingAddress,
              poNumber: order.poNumber,
              costCentre: order.costCentre,
              purchaseOrder: order.poFileName,
              orderNotes: order.orderNotes,
              multipleLocations: order.multipleLocations ? "Yes" : "No",
              multipleLocationsNotes: order.multipleLocationsNotes,
              targetDelivery: order.targetDelivery,
              product: order.product,
              color: order.color,
              technique: order.technique,
              placements: order.placements,
              neckLabel: order.neckLabel,
              totalQty: order.totalQty,
              sizeBreakdown: order.sizeBreakdown,
              estimatedTotal: order.estimatedTotal,
              shippingAddress,
              retryHref: order.retryHref,
            },
      };

      if (!isSampleOrder && order.poFileKey) {
        const attachment = await readUploadedFile(order.poFileKey);
        if (!attachment) {
          throw new Error("The saved purchase order could not be restored");
        }
        const formData = new FormData();
        formData.set("payload", JSON.stringify(payload));
        formData.set(
          "attachment",
          attachment,
          order.poFileName || "purchase-order.pdf"
        );
        return fetch("/api/send-confirmation", {
          method: "POST",
          body: formData,
        });
      }

      return fetch("/api/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    })()
      .then((response) => {
        if (!response.ok) throw new Error("Confirmation email failed");
        window.localStorage.removeItem("mf_pending_order");
        setEmailStatus("sent");
      })
      .catch(() => {
        // Keep the pending order so a reload can retry the acknowledgement.
        setEmailStatus("failed");
      });
  }, [clearCart, isMockPayment, paymentKind, txnid, verified]);

  if (!verified) {
    return (
      <div className="techpack-canvas flex min-h-[80vh] items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
        <div className="techpack-surface w-full max-w-md rounded-[4px] border p-5 text-center sm:rounded-[4px] sm:p-9">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[4px] bg-amber-50 text-2xl text-amber-700">
            !
          </div>
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-[#111111]">
            Payment not verified
          </h1>
          <p className="mb-8 text-sm leading-relaxed text-[#111111]/60">
            We could not validate a PayU response for this page. If money was
            deducted, do not retry immediately—contact us with your transaction
            reference so we can check it safely.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/contact"
              className="rounded-[4px] bg-[var(--color-accent)] px-7 py-3 text-sm font-medium text-white hover:bg-[var(--color-accent-dark)]"
            >
              Contact support
            </Link>
            <Link
              href="/"
              className="rounded-[4px] border border-[#ECE7DF] px-7 py-3 text-sm font-medium text-[#111111]"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isSampleOrder = paymentKind === "sample-cart";
  const firstName = orderSummary.name.split(" ")[0];

  return (
    <>
      {!isSampleOrder && <ConfiguratorTopBar currentStep="reserve" />}
      <div className="techpack-canvas flex min-h-[80vh] items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
        <div className="techpack-surface w-full max-w-md rounded-[4px] border p-5 text-center sm:rounded-[4px] sm:p-9">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[4px] bg-[var(--color-accent)]/10">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            className="stroke-[var(--color-accent)]"
            strokeWidth="2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 className="mb-3 text-3xl font-bold tracking-tight text-[#111111]">
          {isSampleOrder ? "Order placed" : "Reservation confirmed"}
        </h1>
        {isMockPayment && (
          <p className="mb-4 rounded-[4px] border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
            Development preview — no payment was charged.
          </p>
        )}
        <p className="mb-2 text-sm text-[#111111]/60">
          {firstName ? `Thanks ${firstName}!` : "Thank you!"}{" "}
          {isSampleOrder
            ? "Your sample order has been received."
            : "Your production review is reserved."}
        </p>

        {orderDetailsStatus === "missing" && (
          <p role="alert" className="mb-4 rounded-[4px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
            Your payment was verified, but this browser could not restore the local order details.
            Save the transaction ID below and contact support so we can match the payment safely.
          </p>
        )}

        {emailStatus === "sending" && (
          <p className="mb-1 text-sm text-[#111111]/55">Sending your confirmation…</p>
        )}
        {emailStatus === "sent" && orderSummary.email && (
          <p className="mb-1 text-sm">
            Confirmation sent to{" "}
            <span className="font-medium text-[#111111]">{orderSummary.email}</span>
          </p>
        )}
        {emailStatus === "failed" && (
          <p role="alert" className="mb-1 text-sm text-amber-700">
            The payment is verified, but we could not send the email receipt.
            Please save the transaction ID below.
          </p>
        )}

        {txnid && (
          <p className="mb-6 mt-2 text-xs text-[#111111]/40">
            Transaction ID: <span className="break-all font-mono">{txnid}</span>
          </p>
        )}

        <div className="techpack-panel mb-8 rounded-[4px] border p-5 text-left text-xs leading-relaxed text-[#111111]/60">
          <p className="mb-2 font-medium text-[#111111]">What happens next</p>
          {isSampleOrder ? (
            <ul className="flex flex-col gap-1.5">
              <li>· Our team will review and prepare your sample order</li>
              <li>· We will contact you if any delivery detail needs clarification</li>
              <li>· Keep the transaction ID above for your records</li>
            </ul>
          ) : (
            <ul className="flex flex-col gap-1.5">
              <li>· Our team will review your order and send a proforma invoice within 24 hours</li>
              <li>· The ₹499 reservation fee will be credited against your final invoice</li>
              <li>· Production begins only after technical review, your approval and agreed payment terms</li>
            </ul>
          )}
        </div>

        <Link
          href="/"
          className="inline-block rounded-[4px] bg-[var(--color-accent)] px-8 py-3 text-sm font-medium text-white hover:bg-[var(--color-accent-dark)]"
        >
          Back to home
        </Link>
        </div>
      </div>
    </>
  );
}
