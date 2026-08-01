export const CUSTOMER_PRODUCTION_STAGES = [
  "Order received",
  "Payment confirmed",
  "Artwork under review",
  "Artwork approved",
  "Fabric and trims prepared",
  "Printing or embroidery",
  "Stitching and finishing",
  "Quality check",
  "Dispatched",
  "Delivered",
] as const;

export type CustomerProductionStage = Readonly<{
  label: (typeof CUSTOMER_PRODUCTION_STAGES)[number];
  state: "completed" | "current" | "upcoming";
}>;

const stageIndexByOrderStatus: Readonly<Record<string, number>> = {
  awaiting_payment: 1,
  payment_failed: 1,
  expired: 1,
  reservation_paid: 2,
  submitted_for_review: 2,
  needs_customer_action: 2,
  commercial_review: 2,
  quote_ready: 2,
  awaiting_quote_approval: 2,
  awaiting_balance_payment: 2,
  artwork_review: 2,
  awaiting_artwork_approval: 2,
  approved_for_production: 3,
  production_queued: 4,
  in_production: 5,
  quality_control: 7,
  packing: 8,
  ready_to_dispatch: 8,
  dispatched: 8,
  delivered: 9,
};

const interruptedStatuses = new Set(["on_hold", "cancelled", "refunded"]);

function progressStatus(
  currentStatus: string,
  statusHistory: readonly string[],
): string {
  if (!interruptedStatuses.has(currentStatus)) return currentStatus;

  return (
    [...statusHistory]
      .reverse()
      .find((status) => !interruptedStatuses.has(status)) ?? currentStatus
  );
}

export function customerProductionTimeline(
  currentStatus: string,
  statusHistory: readonly string[] = [],
): readonly CustomerProductionStage[] {
  const activeStage =
    stageIndexByOrderStatus[progressStatus(currentStatus, statusHistory)] ?? 0;

  return CUSTOMER_PRODUCTION_STAGES.map((label, index) => ({
    label,
    state:
      index < activeStage
        ? "completed"
        : index === activeStage
          ? "current"
          : "upcoming",
  }));
}
