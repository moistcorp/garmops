export const CUSTOMER_PRODUCTION_STAGES = [
  "Order received",
  "Artwork under review",
  "Approved for production",
  "Material preparation",
  "Printing or embroidery",
  "Stitching",
  "Quality check and packing",
  "Dispatched",
  "Delivered",
] as const;

export type CustomerProductionStage = Readonly<{
  label: (typeof CUSTOMER_PRODUCTION_STAGES)[number];
  state: "completed" | "current" | "upcoming";
}>;

const stageIndexByOrderStatus: Readonly<Record<string, number>> = {
  payment_confirmed: 0,
  order_review: 0,
  artwork_pending: 1,
  artwork_approved: 2,
  production_approved: 2,
  material_preparation: 3,
  printing_embroidery: 4,
  stitching: 5,
  quality_check: 6,
  packing: 6,
  ready_to_dispatch: 6,
  dispatched: 7,
  delivered: 8,
};

const interruptedStatuses = new Set(["on_hold", "cancelled", "refund_pending", "refunded"]);

function progressStatus(currentStatus: string, statusHistory: readonly string[]): string {
  if (!interruptedStatuses.has(currentStatus)) return currentStatus;
  return [...statusHistory].reverse().find((status) => !interruptedStatuses.has(status)) ?? currentStatus;
}

export function customerProductionTimeline(
  currentStatus: string,
  statusHistory: readonly string[] = [],
): readonly CustomerProductionStage[] {
  const activeStage = stageIndexByOrderStatus[progressStatus(currentStatus, statusHistory)] ?? 0;
  return CUSTOMER_PRODUCTION_STAGES.map((label, index) => ({
    label,
    state: index < activeStage ? "completed" : index === activeStage ? "current" : "upcoming",
  }));
}
