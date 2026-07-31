export function formatMoneyPaise(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function formatOrderDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export function formatOrderTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export function formatOrderCode(orderNumber: string): string {
  const normalized = orderNumber.trim();
  const prefix = normalized.startsWith("SAM-") ? "SAMPLE" : "ORDER";
  return `${prefix} · ${normalized}`;
}

export function formatSpecCode(reference: string): string {
  const normalized = reference.trim();
  return `SPEC · ${normalized || "DRAFT"}`;
}

export function publicOrderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    payment_incomplete: "Payment incomplete",
    order_submitted: "Order submitted",
    action_required: "Action required",
    under_review: "Under review",
    awaiting_approval: "Awaiting approval",
    payment_due: "Payment due",
    approved: "Approved",
    in_production: "In production",
    quality_check: "Quality check",
    ready_to_dispatch: "Ready to dispatch",
    dispatched: "Dispatched",
    delivered: "Delivered",
    on_hold: "On hold",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}
