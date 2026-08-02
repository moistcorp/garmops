import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarCheck2,
  CheckCircle2,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";

import PaymentRetryButton from "@/components/account/PaymentRetryButton";
import PortalPlaceholder from "@/components/portal/PortalPlaceholder";
import { requireOrganizationMember } from "@/lib/auth/guards";
import { isFeatureEnabled } from "@/lib/config/featureFlags";
import { getCustomerOrder } from "@/lib/orders/dal";
import {
  formatOrderCode,
  formatMoneyPaise,
  formatOrderDate,
} from "@/lib/orders/format";
import { orderNumberSchema } from "@/lib/orders/schema";

export const dynamic = "force-dynamic";

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const number = orderNumberSchema.safeParse((await params).orderNumber);
  if (!number.success) notFound();
  const { supabase, membership, user } = await requireOrganizationMember(
    `/account/orders/${number.data}/confirmation`,
  );

  let result: Awaited<ReturnType<typeof getCustomerOrder>>;
  try {
    result = await getCustomerOrder(
      supabase,
      membership.organization_id,
      user.id,
      number.data,
    );
  } catch {
    return (
      <PortalPlaceholder
        title="Confirmation unavailable"
        description="Your order is retained, but its payment details could not be loaded."
      />
    );
  }
  if (result.order.error || !result.order.data) notFound();
  const order = result.order.data;
  const sampleOrder = order.order_type === "sample_purchase";
  const orderFlowEnabled = sampleOrder
    ? isFeatureEnabled("DURABLE_SAMPLE_CHECKOUT_ENABLED")
    : isFeatureEnabled("DURABLE_CUSTOM_CHECKOUT_ENABLED");
  const latestPayment = result.payments[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="techpack-surface overflow-hidden rounded-[4px] border">
        <div className="bg-[#1D49B4] px-6 py-8 text-white sm:px-8">
          <CheckCircle2 size={30} aria-hidden="true" />
          <p className="mt-5 text-xs uppercase tracking-[0.2em] text-white/55">
            Your order has been saved
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            {formatOrderCode(order.order_number)}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Complete the payment below. You can return to this order from My
            orders at any time.
          </p>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
          {[
            {
              icon: CalendarCheck2,
              label: "Order date",
              value: formatOrderDate(order.submitted_at),
            },
            {
              icon: FileCheck2,
              label: "Estimated total",
              value: formatMoneyPaise(order.estimated_total_paise),
            },
            {
              icon: ShieldCheck,
              label: sampleOrder ? "Full amount due" : "Due now",
              value: formatMoneyPaise(
                sampleOrder
                  ? order.estimated_total_paise
                  : order.reservation_amount_paise,
              ),
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[4px] border border-black/7 bg-white p-4"
            >
              <item.icon
                size={17}
                className="text-[#1D49B4]"
                aria-hidden="true"
              />
              <p className="mt-4 text-[10px] uppercase tracking-widest text-black/30">
                {item.label}
              </p>
              <p className="mt-2 text-sm font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="techpack-panel rounded-[4px] border p-6 sm:p-8">
        <h3 className="text-lg font-semibold">
          {sampleOrder ? "Continue with the full sample payment" : "Continue with the reservation payment"}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-black/50">
          Your payment history is saved with this order.
        </p>
        <div className="mt-6">
          {!orderFlowEnabled ? (
            <p className="text-sm leading-relaxed text-amber-800">
              Online payment is currently unavailable. Your order remains saved,
              and you can view its status from My orders.
            </p>
          ) : latestPayment && ["created", "initiated"].includes(latestPayment.status) ? (
            <PaymentRetryButton
              initialPaymentAttemptId={latestPayment.id}
              paymentPurpose={latestPayment.purpose as "reservation" | "sample_full"}
            />
          ) : latestPayment?.status === "failed" ? (
            <p className="text-sm leading-relaxed text-red-700">
              This payment was not completed. Please contact Garmops support to continue.
            </p>
          ) : latestPayment?.status === "pending" ? (
            <p className="text-sm leading-relaxed text-amber-800">
              PayU verification is pending. Do not make another payment; this
              attempt is being reconciled automatically.
            </p>
          ) : latestPayment?.status === "paid" ? (
            <p className="text-sm leading-relaxed text-emerald-700">
              {sampleOrder ? "The sample payment" : "The reservation payment"} has been verified. Open the order to see
              its current status.
            </p>
          ) : (
            <p className="text-sm text-red-700">
              The payment attempt could not be loaded. Your order remains
              saved.
            </p>
          )}
        </div>
        <div className="mt-6 border-t border-black/8 pt-5">
          <Link
            href={`/account/orders/${encodeURIComponent(order.order_number)}`}
            className="text-sm font-semibold text-[#1D49B4] hover:underline"
          >
            View order details
          </Link>
        </div>
      </section>
    </div>
  );
}
