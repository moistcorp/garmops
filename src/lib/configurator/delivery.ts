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

export function getDeliveryOptions(orderConfirmedDate: Date): DeliveryOptions {
  const standard = addDays(orderConfirmedDate, 35);
  const rush = addDays(orderConfirmedDate, 18);

  return {
    rush,
    standard,
    flexible: (customDate: Date) => customDate >= standard,
  };
}