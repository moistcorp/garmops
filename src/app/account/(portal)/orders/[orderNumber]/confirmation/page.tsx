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
  formatMoneyPaise,
  formatOrderDate,
} from "@/lib/orders/format";
import { orderNumberSchema } from "@/lib/orders/schema";

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  if (!isFeatureEnabled("DURABLE_CUSTOM_CHECKOUT_ENABLED")) {
    return (
      <PortalPlaceholder
        title="Confirmation unavailable"
        description="Durable custom ordering is disabled for this environment."
      />
    );
  }

  const number = orderNumberSchema.safeParse((await params).orderNumber);
  if (!number.success) notFound();
  const { supabase, membership } = await requireOrganizationMember(
    `/account/orders/${number.data}/confirmation`,
  );

  let result: Awaited<ReturnType<typeof getCustomerOrder>>;
  try {
    result = await getCustomerOrder(
      supabase,
      membership.organization_id,
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
  const latestPayment = result.payments[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="liquid-glass-surface overflow-hidden rounded-3xl border">
        <div className="bg-[#315F66] px-6 py-8 text-white sm:px-8">
          <CheckCircle2 size={30} aria-hidden="true" />
          <p className="mt-5 text-xs uppercase tracking-[0.2em] text-white/55">
            Order saved before payment
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            {order.order_number}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            You can refresh this page or continue on another device. The order
            number, date, specification, addresses, totals, and first payment
            attempt are already durable.
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
              label: "Due now",
              value: formatMoneyPaise(order.reservation_amount_paise),
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-black/7 bg-white/45 p-4"
            >
              <item.icon
                size={17}
                className="text-[#4F8B92]"
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

      <section className="liquid-glass-panel rounded-3xl border p-6 sm:p-8">
        <h3 className="text-lg font-semibold">
          Continue with the reservation payment
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-black/50">
          Payment attempts belong to this order. Retrying never changes the
          order number or overwrites an earlier attempt.
        </p>
        <div className="mt-6">
          {latestPayment ? (
            <PaymentRetryButton
              orderNumber={order.order_number}
              initialAttemptNumber={latestPayment.attempt_number}
              confirmation
            />
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
            className="text-sm font-semibold text-[#315F66] hover:underline"
          >
            Review the full immutable order
          </Link>
        </div>
      </section>
    </div>
  );
}
