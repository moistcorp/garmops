import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  PackageCheck,
  ShoppingBag,
  WalletCards,
} from "lucide-react";

import PortalPlaceholder from "@/components/portal/PortalPlaceholder";
import { requireOrganizationMember } from "@/lib/auth/guards";
import { isFeatureEnabled } from "@/lib/config/featureFlags";
import { listCustomerOrders } from "@/lib/orders/dal";
import {
  formatOrderCode,
  formatMoneyPaise,
  formatOrderDate,
  publicOrderStatusLabel,
} from "@/lib/orders/format";
import { orderListFilterSchema, type OrderListFilter } from "@/lib/orders/schema";

export const dynamic = "force-dynamic";

const filters: Array<{ value: OrderListFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  if (
    !isFeatureEnabled("DURABLE_CUSTOM_CHECKOUT_ENABLED") &&
    !isFeatureEnabled("DURABLE_SAMPLE_CHECKOUT_ENABLED")
  ) {
    return (
      <PortalPlaceholder
        title="Orders"
        description="Durable ordering is disabled for this environment."
      />
    );
  }

  const filterResult = orderListFilterSchema.safeParse(
    (await searchParams).filter ?? "all",
  );
  const filter = filterResult.success ? filterResult.data : "all";
  const { supabase, membership, user } = await requireOrganizationMember(
    "/account/orders",
  );
  const { data, error } = await listCustomerOrders(
    supabase,
    membership.organization_id,
    user.id,
    filter,
  );

  if (error) {
    return (
      <PortalPlaceholder
        title="Orders unavailable"
        description="Your durable order history could not be loaded. Try again shortly."
      />
    );
  }
  const orders = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#1D49B4]">
            Account
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            My orders
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/50">
            View the status and details of orders placed with Garmops.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isFeatureEnabled("DURABLE_SAMPLE_CHECKOUT_ENABLED") ? (
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 rounded-[4px] border border-black/10 px-4 py-2.5 text-sm font-semibold transition hover:border-[#1D49B4]/40"
            >
              Browse samples
            </Link>
          ) : null}
          {isFeatureEnabled("DURABLE_CUSTOM_CHECKOUT_ENABLED") ? (
            <Link
              href="/configurator"
              className="inline-flex items-center justify-center gap-2 rounded-[4px] bg-[#1D49B4] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#173A91]"
            >
              <ShoppingBag size={16} aria-hidden="true" />
              Start designing
            </Link>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-black/8 pb-3">
        {filters.map((entry) => (
          <Link
            key={entry.value}
            href={
              entry.value === "all"
                ? "/account/orders"
                : `/account/orders?filter=${entry.value}`
            }
            className={`whitespace-nowrap rounded-[4px] px-3 py-1.5 text-xs font-semibold ${
              filter === entry.value
                ? "bg-[#1D49B4] text-white"
                : "bg-black/5 text-black/55 hover:bg-black/8"
            }`}
          >
            {entry.label}
          </Link>
        ))}
      </div>

      {orders.length ? (
        <div className="space-y-3">
          {orders.map((order) => {
            const item = order.order_items?.[0];
            const paymentIncomplete =
              order.public_status === "payment_incomplete";
            const totalQuantity = order.order_items?.reduce(
              (total, orderItem) => total + orderItem.quantity,
              0,
            ) ?? 0;
            return (
              <Link
                key={order.id}
                href={`/account/orders/${encodeURIComponent(order.order_number)}`}
                className="group techpack-surface grid gap-5 rounded-[4px] border p-5 transition hover:-translate-y-0.5 hover:border-[#1D49B4]/30 hover:bg-black/[0.03] lg:grid-cols-[1.2fr_0.9fr_1fr_0.9fr_auto] lg:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{formatOrderCode(order.order_number)}</h3>
                    <span
                      className="techpack-stamp"
                      data-tone={paymentIncomplete ? "warning" : "accent"}
                    >
                      {publicOrderStatusLabel(order.public_status)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-black/50">
                    {item?.product_name ??
                      (order.order_type === "sample_purchase"
                        ? "Catalogue samples"
                        : "Custom merchandise")}
                    {totalQuantity ? ` · ${totalQuantity.toLocaleString("en-IN")} units` : ""}
                    {order.order_type === "sample_purchase" ? " · Sample order" : ""}
                  </p>
                  <p className="mt-1 text-xs text-black/45">
                    Estimated total {formatMoneyPaise(order.estimated_total_paise)}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CalendarDays
                    size={16}
                    className="mt-0.5 text-[#1D49B4]"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-black/30">
                      Order date
                    </p>
                    <p className="mt-1 text-sm text-black/65">
                      {formatOrderDate(order.submitted_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CalendarDays size={16} className="mt-0.5 text-[#1D49B4]" aria-hidden="true" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-black/30">{order.requested_delivery_date ? "Requested delivery" : "Estimated total"}</p>
                    <p className="mt-1 text-sm text-black/65">{order.requested_delivery_date ? formatOrderDate(`${order.requested_delivery_date}T00:00:00Z`) : formatMoneyPaise(order.estimated_total_paise)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  {paymentIncomplete ? (
                    <WalletCards
                      size={16}
                      className="mt-0.5 text-amber-700"
                      aria-hidden="true"
                    />
                  ) : (
                    <PackageCheck
                      size={16}
                      className="mt-0.5 text-[#1D49B4]"
                      aria-hidden="true"
                    />
                  )}
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-black/30">
                      {order.order_type === "sample_purchase"
                        ? "Full payment"
                        : "Reservation"}
                    </p>
                    <p className="mt-1 text-sm text-black/65">
                      {formatMoneyPaise(
                        order.order_type === "sample_purchase"
                          ? order.estimated_total_paise
                          : order.reservation_amount_paise,
                      )} · {paymentIncomplete ? "unpaid" : "recorded"}
                    </p>
                  </div>
                </div>
                <ArrowRight
                  size={18}
                  className="text-black/25 transition group-hover:translate-x-0.5 group-hover:text-[#1D49B4]"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="techpack-surface rounded-[4px] border border-dashed p-10 text-center">
          <ShoppingBag
            size={28}
            className="mx-auto text-[#1D49B4]"
            aria-hidden="true"
          />
          <h3 className="mt-4 font-semibold">No matching orders</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-black/45">
            You have not placed any orders yet. Start designing when you are ready.
          </p>
        </div>
      )}
    </div>
  );
}
