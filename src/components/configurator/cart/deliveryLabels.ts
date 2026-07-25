import type { CartDraft } from "./cartDraft";

export function formatDeliveryDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getDeliveryTypeLabel(deliveryType?: CartDraft["deliveryType"]): string {
  if (deliveryType === "rush") return "Rush";
  if (deliveryType === "standard") return "Standard";
  return "Flexible";
}

export function getDeliveryLabel(
  selectedDate?: Date,
  deliveryType?: CartDraft["deliveryType"]
): string {
  if (!selectedDate) return "Select a delivery date";
  return `${getDeliveryTypeLabel(deliveryType)} - ${formatDeliveryDate(selectedDate)}`;
}
