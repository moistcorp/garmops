// src/lib/configurator/delivery.ts

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isValidDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}

function isSameDay(a: Date, b: Date): boolean {
  return isValidDate(a) && isValidDate(b) && startOfDay(a).getTime() === startOfDay(b).getTime();
}

export type DeliveryOptions = {
  rush: Date;
  standard: Date;
  flexible: (customDate: Date) => boolean;
};

export function getDeliveryOptions(orderConfirmedDate: Date, extraLeadTimeDays = 0): DeliveryOptions {
  const standard = addDays(orderConfirmedDate, 35 + extraLeadTimeDays);
  const rush = addDays(orderConfirmedDate, 18 + extraLeadTimeDays);

  return {
    rush,
    standard,
    flexible: (customDate: Date) => startOfDay(customDate) >= startOfDay(standard),
  };
}

export function isDeliverySelectionValid(
  deliveryType: "rush" | "standard" | "flexible" | undefined,
  selectedDate: Date | undefined,
  orderConfirmedDate: Date,
  extraLeadTimeDays = 0
): boolean {
  if (!deliveryType || !selectedDate || !isValidDate(selectedDate) || !isValidDate(orderConfirmedDate)) {
    return false;
  }

  const options = getDeliveryOptions(orderConfirmedDate, extraLeadTimeDays);
  if (deliveryType === "rush") return isSameDay(selectedDate, options.rush);
  if (deliveryType === "standard") return isSameDay(selectedDate, options.standard);
  return options.flexible(selectedDate);
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDeliveryLabel(
  deliveryType?: "rush" | "standard" | "flexible",
  date?: Date
): string {
  if (!date) return "Select a delivery date";

  const typeLabel =
    deliveryType === "rush"
      ? "Rush"
      : deliveryType === "standard"
        ? "Standard"
        : "Flexible";

  return `${typeLabel} · ${formatDate(date)}`;
}
