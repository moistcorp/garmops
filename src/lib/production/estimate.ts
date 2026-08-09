import { DELIVERY_DAYS, RUSH_DELIVERY_DAYS } from "@/lib/pricingRules";

export type ProductionCapacityConfig = Readonly<{
  workingWeekdays: readonly number[];
  blackoutDates: readonly string[];
  dailyUnitCapacity?: number;
  committedUnits?: number;
  extraWorkingDays?: number;
}>;

export type ProductionWindow = Readonly<{
  estimatedDispatchDate: string;
  usedFallback: boolean;
  workingDays: number;
}>;

function indiaDate(date = new Date()): Date {
  return new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date) + "T00:00:00+05:30");
}

export function estimateProductionWindow(input: {
  quantity: number;
  requestedMode: "rush" | "standard" | "flexible";
  capacity?: ProductionCapacityConfig;
  now?: Date;
}): ProductionWindow {
  const fallbackDays = input.requestedMode === "rush" ? RUSH_DELIVERY_DAYS : DELIVERY_DAYS;
  const configured = input.capacity?.dailyUnitCapacity && input.capacity.workingWeekdays.length > 0;
  const loadDays = configured
    ? Math.ceil((input.quantity + (input.capacity?.committedUnits ?? 0)) / input.capacity!.dailyUnitCapacity!) + (input.capacity?.extraWorkingDays ?? 0)
    : fallbackDays;
  // Incomplete capacity configuration can never produce an earlier promise.
  const workingDays = configured ? Math.max(fallbackDays, loadDays) : fallbackDays;
  const working = new Set(input.capacity?.workingWeekdays.length ? input.capacity.workingWeekdays : [1, 2, 3, 4, 5, 6]);
  const blackouts = new Set(input.capacity?.blackoutDates ?? []);
  const date = indiaDate(input.now);
  let counted = 0;
  while (counted < workingDays) {
    date.setUTCDate(date.getUTCDate() + 1);
    const key = date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const weekday = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(date).replace(/Sun|Mon|Tue|Wed|Thu|Fri|Sat/, (v) => String(["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(v))));
    if (working.has(weekday) && !blackouts.has(key)) counted += 1;
  }
  return { estimatedDispatchDate: date.toISOString(), usedFallback: !configured, workingDays };
}
