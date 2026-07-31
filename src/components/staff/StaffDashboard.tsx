import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeIndianRupee,
  CircleDotDashed,
  Clock3,
  FileWarning,
  PackageCheck,
  UserRoundX,
  UsersRound,
} from "lucide-react";

import { requireStaffPermission } from "@/lib/auth/guards";
import { getStaffDashboardMetrics } from "@/lib/staff/dal";

export default async function StaffDashboard() {
  const { supabase } = await requireStaffPermission("view_all_orders");
  const metrics = await getStaffDashboardMetrics(supabase);
  const cards = [
    {
      label: "New paid reservations",
      value: metrics.newPaidReservations,
      description: "Waiting for operational review",
      href: "/staff/orders?status=reservation_paid",
      icon: BadgeIndianRupee,
    },
    {
      label: "New paid samples",
      value: metrics.newPaidSampleOrders,
      description: "Fully paid sample orders awaiting fulfilment",
      href: "/staff/orders?orderType=sample_purchase&status=submitted_for_review",
      icon: PackageCheck,
    },
    {
      label: "Customer action required",
      value: metrics.actionRequired,
      description: "Open requests or action status",
      href: "/staff/orders?status=needs_customer_action",
      icon: UsersRound,
    },
    {
      label: "Artwork overdue",
      value: metrics.artworkOverdue,
      description: "Approval date has passed",
      href: "/staff/orders?overdue=true&missing=approval",
      icon: FileWarning,
    },
    {
      label: "Production at risk",
      value: metrics.productionAtRisk,
      description: "Expected milestone due soon",
      href: "/staff/orders?atRisk=true",
      icon: AlertTriangle,
    },
    {
      label: "Ready for QC / dispatch",
      value: metrics.readyForQcDispatch,
      description: "Orders needing the next operational step",
      href: "/staff/orders?status=quality_control",
      icon: PackageCheck,
    },
    {
      label: "Invoice exceptions",
      value: metrics.invoiceExceptions,
      description: "Retryable or permanent Zoho failures",
      href: "/staff/invoices",
      icon: CircleDotDashed,
    },
    {
      label: "Pending PayU checks",
      value: metrics.pendingPayu,
      description: "Stale attempts needing reconciliation",
      href: "/staff/orders?paymentState=pending",
      icon: Clock3,
    },
    {
      label: "Unassigned priority",
      value: metrics.unassignedPriority,
      description: "High or urgent orders without an owner",
      href: "/staff/orders?priority=high",
      icon: UserRoundX,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="liquid-glass-surface rounded-3xl border p-6 sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#315F66]">
          Operations dashboard
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Work that needs attention
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/50">
              These are operational exceptions, not vanity metrics. Open a queue to assign an owner, set dates, request customer action, or move the order through an allowed stage.
            </p>
          </div>
          <Link
            href="/staff/orders?myOrders=true"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#315F66] hover:underline"
          >
            My orders <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="liquid-glass-panel group rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:border-[#4F8B92]/40"
          >
            <div className="flex items-center justify-between gap-3">
              <card.icon size={18} className="text-[#4F8B92]" aria-hidden="true" />
              <ArrowRight size={14} className="text-black/25 transition group-hover:text-[#4F8B92]" aria-hidden="true" />
            </div>
            <p className="mt-5 text-3xl font-semibold">{card.value.toLocaleString("en-IN")}</p>
            <p className="mt-2 text-sm font-semibold">{card.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-black/40">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
