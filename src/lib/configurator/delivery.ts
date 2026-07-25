// src/lib/configurator/delivery.ts

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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

  return `${typeLabel} - ${formatDate(date)}`;
}
