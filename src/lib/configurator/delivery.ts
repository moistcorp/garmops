// src/lib/configurator/delivery.ts

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
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
    flexible: (customDate: Date) => customDate >= standard,
  };
}
