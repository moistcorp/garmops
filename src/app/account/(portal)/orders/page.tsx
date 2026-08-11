import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, ShoppingBag } from "lucide-react";

import PendingCheckoutRecovery from "@/components/payment/PendingCheckoutRecovery";
import PortalPlaceholder from "@/components/portal/PortalPlaceholder";
import TechpackPageHeader from "@/components/portal/TechpackPageHeader";
import { requireCustomer } from "@/lib/auth/guards";
import { CUSTOMER_ORDER_PAGE_SIZE, listCustomerOrders } from "@/lib/orders/dal";
import {
  formatMoneyPaise,
  formatOrderCode,
  formatOrderDate,
  publicOrderStatusLabel,
} from "@/lib/orders/format";
import {
  orderListFilterSchema,
  orderListPageSchema,
  type OrderListFilter,
} from "@/lib/orders/schema";
import type { Tables } from "@/types/database.generated";

type OrderListRow = Pick<
  Tables<"orders">,
  | "id"
  | "order_number"
  | "public_status"
  | "total_paise"
  | "amount_paid_paise"
  | "confirmed_at"
  | "created_at"
> & {
  order_items: Array<Pick<Tables<"order_items">, "product_name" | "quantity">>;
};

export const dynamic = "force-dynamic";

const filters: Array<{ value: OrderListFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function ordersHref(filter: OrderListFilter, page = 1): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/account/orders?${query}` : "/account/orders";
}

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    page?: string;
    payment?: string;
    checkoutAttempt?: string;
  }>;
}) {
  const query = await searchParams;
  const parsedFilter = orderListFilterSchema.safeParse(query.filter ?? "all");
  const parsedPage = orderListPageSchema.safeParse(query.page ?? "1");
  const filter = parsedFilter.success ? parsedFilter.data : "all";
  const page = parsedPage.success ? parsedPage.data : 1;
  const paymentOutcome =
    query.payment === "pending" || query.payment === "failure"
      ? query.payment
      : undefined;
  const checkoutAttemptId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    query.checkoutAttempt ?? "",
  )
    ? query.checkoutAttempt
    : undefined;
  const { supabase, user } = await requireCustomer("/account/orders");
  const result = await listCustomerOrders(supabase, user.id, filter, page);

  if (result.error) {
    return (
      <PortalPlaceholder
        title="Orders unavailable"
        description="Your private order history could not be loaded."
      />
    );
  }

  const orders = (result.data ?? []) as unknown as OrderListRow[];
  const totalOrders = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalOrders / CUSTOMER_ORDER_PAGE_SIZE));

  if (page > totalPages && totalOrders > 0) {
    return (
      <PortalPlaceholder
        title="Order page unavailable"
        description="That order-history page does not exist. Return to the first page of your orders."
      />
    );
  }

  return (
    <div className="space-y-6">
      <TechpackPageHeader
        eyebrow="Customer account"
        reference="Private order register"
        title="My orders"
        description="Only orders placed by this exact customer account are visible here."
        actions={
          <Link
            href="/configurator"
            className="inline-flex items-center gap-2 rounded bg-(--color-accent) px-4 py-2.5 text-sm font-semibold text-white"
          >
            <ShoppingBag size={16} />
            Start designing
          </Link>
        }
      />

      {paymentOutcome ? (
        <PendingCheckoutRecovery
          outcome={paymentOutcome}
          checkoutAttemptId={checkoutAttemptId}
          retryHref="/checkout"
          retryLabel="Return to sample checkout"
        />
      ) : null}

      <div className="flex gap-2 overflow-x-auto border-b border-black/8 pb-3">
        {filters.map((entry) => (
          <Link
            key={entry.value}
            href={ordersHref(entry.value)}
            className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-semibold ${
              filter === entry.value
                ? "bg-(--color-accent) text-white"
                : "bg-black/5 text-black/55"
            }`}
          >
            {entry.label}
          </Link>
        ))}
      </div>

      {orders.length ? (
        <div className="space-y-3">
          {orders.map((order) => {
            const quantity = (order.order_items ?? []).reduce(
              (sum, item) => sum + item.quantity,
              0,
            );
            return (
              <Link
                key={order.id}
                href={`/account/orders/${encodeURIComponent(order.order_number)}`}
                className="group techpack-surface grid gap-5 rounded border p-5 transition hover:border-(--color-accent)/30 lg:grid-cols-[1.2fr_0.8fr_0.8fr_auto] lg:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">
                      {formatOrderCode(order.order_number)}
                    </h3>
                    <span className="techpack-stamp" data-tone="accent">
                      {publicOrderStatusLabel(order.public_status)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-black/50">
                    {order.order_items?.[0]?.product_name ?? "Custom garment order"}
                    {order.order_items && order.order_items.length > 1
                      ? ` + ${order.order_items.length - 1} more configured ${order.order_items.length === 2 ? "item" : "items"}`
                      : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-black/40">Order total</p>
                  <p className="mt-1 font-semibold">
                    {formatMoneyPaise(order.total_paise)}
                  </p>
                  <p className="text-xs text-black/40">
                    Paid {formatMoneyPaise(order.amount_paid_paise)}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-black/50">
                  <CalendarDays size={15} />
                  {formatOrderDate(order.confirmed_at || order.created_at)} · {quantity} units
                </div>
                <ArrowRight className="text-(--color-accent)" size={18} />
              </Link>
            );
          })}

          {totalPages > 1 ? (
            <nav
              aria-label="Order history pagination"
              className="flex items-center justify-between gap-4 pt-3"
            >
              {page > 1 ? (
                <Link
                  href={ordersHref(filter, page - 1)}
                  className="inline-flex items-center gap-2 rounded border border-black/10 px-4 py-2 text-sm font-semibold"
                >
                  <ArrowLeft size={15} /> Previous
                </Link>
              ) : (
                <span />
              )}
              <p className="text-xs text-black/45">
                Page {page} of {totalPages} · {totalOrders} orders
              </p>
              {page < totalPages ? (
                <Link
                  href={ordersHref(filter, page + 1)}
                  className="inline-flex items-center gap-2 rounded border border-black/10 px-4 py-2 text-sm font-semibold"
                >
                  Next <ArrowRight size={15} />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </div>
      ) : (
        <PortalPlaceholder
          title="No orders yet"
          description="Your first verified full-payment order will appear here."
        />
      )}
    </div>
  );
}
