// src/lib/configurator/delivery.ts

import { RUSH_DELIVERY_FEE_PER_UNIT } from "@/lib/pricingRules";

const INDIA_TIME_ZONE = "Asia/Kolkata";

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

export type DeliveryType = "rush" | "standard" | "flexible";

export const RUSH_DELIVERY_SURCHARGE_RUPEES = RUSH_DELIVERY_FEE_PER_UNIT;
export const RUSH_DELIVERY_SURCHARGE_PAISE = RUSH_DELIVERY_SURCHARGE_RUPEES * 100;

export type DeliveryOptions = {
  rush: Date;
  standard: Date;
  flexible: (customDate: Date) => boolean;
};

export function getIndiaCalendarDate(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
      .map((part) => [part.type, Number(part.value)]),
  );

  return new Date(values.year, values.month - 1, values.day);
}

export function parseIsoDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    !isValidDate(date) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

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
  deliveryType: DeliveryType | undefined,
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

export function getRequestedDeliveryDateError(input: {
  deliveryType: DeliveryType;
  requestedDeliveryDate: string;
  extraLeadTimeDays?: number;
  now?: Date;
}): string | null {
  const requestedDate = parseIsoDateOnly(input.requestedDeliveryDate);
  if (!requestedDate) {
    return "Requested delivery date is invalid. Return to delivery details and choose it again.";
  }

  const todayInIndia = getIndiaCalendarDate(input.now);
  const extraLeadTimeDays = input.extraLeadTimeDays ?? 0;
  if (
    isDeliverySelectionValid(
      input.deliveryType,
      requestedDate,
      todayInIndia,
      extraLeadTimeDays,
    )
  ) {
    return null;
  }

  const options = getDeliveryOptions(todayInIndia, extraLeadTimeDays);
  if (input.deliveryType === "rush") {
    return `Your saved rush delivery date is no longer available. Return to delivery details and choose ${formatDate(options.rush)}.`;
  }
  if (input.deliveryType === "standard") {
    return `Your saved standard delivery date is no longer available. Return to delivery details and choose ${formatDate(options.standard)}.`;
  }
  return `Your saved delivery date is no longer available. Return to delivery details and choose a date on or after ${formatDate(options.standard)}.`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDeliveryLabel(
  deliveryType?: DeliveryType,
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
