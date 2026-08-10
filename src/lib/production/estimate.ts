import { DELIVERY_DAYS, RUSH_DELIVERY_DAYS } from "@/lib/pricingRules";

export type ProductionRule = Readonly<{
  productCategory: string | null;
  technique: string | null;
  dailyUnitCapacity: number;
  effectiveFrom?: string;
}>;

export type ProductionLeadTimeRule = Readonly<{
  productCategory: string | null;
  technique: string | null;
  customDyeExtraDays: number;
  setupBufferDays: number;
  qcDispatchBufferDays: number;
  rushEligible: boolean;
}>;

export type ProductionCartItem = Readonly<{
  productId?: string;
  productCategory: string;
  quantity: number;
  techniques?: readonly (string | null)[];
  customDye?: boolean;
}>;

export type ProductionCapacityConfig = Readonly<{
  workingWeekdays: readonly number[];
  blackoutDates: readonly string[];
  capacityRules?: readonly ProductionRule[];
  leadTimeRules?: readonly ProductionLeadTimeRule[];
  dailyUnitCapacity?: number;
  committedUnits?: number;
  extraWorkingDays?: number;
}>;

export type ProductionPathEstimate = Readonly<{
  productCategory: string;
  technique: string | null;
  capacityRule: ProductionRule | null;
  leadTimeRule: ProductionLeadTimeRule | null;
  workingDays: number;
  rushEligible: boolean;
}>;

export type ProductionPlan = Readonly<{
  earliestStandardDate: string;
  earliestRushDate: string | null;
  rushEligible: boolean;
  requestedDateFeasible: boolean;
  constraints: readonly string[];
  paths: readonly ProductionPathEstimate[];
  usedFallback: boolean;
}>;

export type ProductionWindow = Readonly<{
  estimatedDispatchDate: string;
  usedFallback: boolean;
  workingDays: number;
}>;

function indiaDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addWorkingDays(
  start: string,
  days: number,
  workingWeekdays: readonly number[],
  blackoutDates: readonly string[],
): string {
  const working = new Set(workingWeekdays.length ? workingWeekdays : [1, 2, 3, 4, 5, 6]);
  const blackouts = new Set(blackoutDates);
  const date = parseDateKey(start);
  let counted = 0;
  while (counted < days) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (working.has(date.getUTCDay()) && !blackouts.has(toDateKey(date))) counted += 1;
  }
  return toDateKey(date);
}

function matchingScore(
  productCategory: string,
  technique: string | null,
  rule: { productCategory: string | null; technique: string | null },
): number {
  const categoryMatches = rule.productCategory === productCategory;
  const techniqueMatches = rule.technique === technique;
  if (rule.productCategory !== null && !categoryMatches) return -1;
  if (rule.technique !== null && !techniqueMatches) return -1;
  // Explicit precedence: category + technique, category, technique, global.
  return (rule.productCategory !== null ? 2 : 0) + (rule.technique !== null ? 1 : 0);
}

function resolveRule<T extends { productCategory: string | null; technique: string | null }>(
  productCategory: string,
  technique: string | null,
  rules: readonly T[] | undefined,
): T | null {
  let selected: T | null = null;
  let selectedScore = -1;
  for (const rule of rules ?? []) {
    const score = matchingScore(productCategory, technique, rule);
    if (score < selectedScore) continue;
    if (score === selectedScore && selected) {
      const ruleEffective = (rule as T & { effectiveFrom?: string }).effectiveFrom;
      const selectedEffective = (selected as T & { effectiveFrom?: string }).effectiveFrom;
      if (!ruleEffective || !selectedEffective || ruleEffective < selectedEffective) continue;
    }
    selected = rule;
    selectedScore = score;
  }
  return selected;
}

function pathTechniques(item: ProductionCartItem): readonly (string | null)[] {
  const techniques = [...new Set((item.techniques ?? []).filter((value): value is string => Boolean(value)))];
  return techniques.length ? techniques : [null];
}

export function estimateProductionPlan(input: {
  items: readonly ProductionCartItem[];
  requestedMode: "rush" | "standard" | "flexible";
  requestedDate?: string;
  capacity: ProductionCapacityConfig;
  now?: Date;
}): ProductionPlan {
  if (!input.items.length) throw new Error("Production estimate requires at least one cart item");
  const fallbackStandard = DELIVERY_DAYS;
  const fallbackRush = RUSH_DELIVERY_DAYS;
  const paths: ProductionPathEstimate[] = [];
  const constraints: string[] = [];

  for (const item of input.items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new Error("Production quantity is invalid");
    for (const technique of pathTechniques(item)) {
      const capacityRule = resolveRule(item.productCategory, technique, input.capacity.capacityRules);
      const leadTimeRule = resolveRule(item.productCategory, technique, input.capacity.leadTimeRules);
      const dailyCapacity = capacityRule?.dailyUnitCapacity ?? input.capacity.dailyUnitCapacity;
      const configuredCapacity = Boolean(dailyCapacity && input.capacity.workingWeekdays.length);
      const loadDays = configuredCapacity
        ? Math.ceil((item.quantity + (input.capacity.committedUnits ?? 0)) / dailyCapacity!)
        : 0;
      const baseDays = Math.max(fallbackStandard, loadDays);
      const bufferDays = (leadTimeRule?.setupBufferDays ?? 0)
        + (leadTimeRule?.qcDispatchBufferDays ?? 0)
        + (item.customDye ? leadTimeRule?.customDyeExtraDays ?? 0 : 0)
        + (input.capacity.extraWorkingDays ?? 0);
      const workingDays = baseDays + bufferDays;
      const rushEligible = leadTimeRule?.rushEligible === true;
      if (!rushEligible) constraints.push(`${item.productCategory}${technique ? ` / ${technique}` : ""} is not rush eligible`);
      paths.push({ productCategory: item.productCategory, technique, capacityRule, leadTimeRule, workingDays, rushEligible });
    }
  }

  const workingWeekdays = input.capacity.workingWeekdays.length ? input.capacity.workingWeekdays : [1, 2, 3, 4, 5, 6];
  const standardWorkingDays = Math.max(...paths.map((path) => path.workingDays));
  const standardDate = addWorkingDays(indiaDateKey(input.now), standardWorkingDays, workingWeekdays, input.capacity.blackoutDates);
  const rushEligible = paths.every((path) => path.rushEligible);
  const rushWorkingDays = Math.max(...paths.map((path) => Math.max(fallbackRush, path.workingDays - fallbackStandard + fallbackRush)));
  const rushDate = rushEligible
    ? addWorkingDays(indiaDateKey(input.now), rushWorkingDays, workingWeekdays, input.capacity.blackoutDates)
    : null;
  const requestedDate = input.requestedDate;
  const requestedDateFeasible = requestedDate
    ? input.requestedMode === "rush"
      ? Boolean(rushDate && requestedDate >= rushDate)
      : requestedDate >= standardDate
    : true;
  if (input.requestedMode === "rush" && !rushEligible && !constraints.includes("Rush is unavailable for this configuration")) {
    constraints.push("Rush is unavailable for this configuration");
  }
  return {
    earliestStandardDate: standardDate,
    earliestRushDate: rushDate,
    rushEligible,
    requestedDateFeasible: requestedDateFeasible && !(input.requestedMode === "rush" && !rushEligible),
    constraints,
    paths,
    usedFallback: !input.capacity.capacityRules?.length && !input.capacity.leadTimeRules?.length,
  };
}

export function estimateProductionWindow(input: {
  quantity: number;
  requestedMode: "rush" | "standard" | "flexible";
  capacity?: ProductionCapacityConfig;
  now?: Date;
}): ProductionWindow {
  const plan = estimateProductionPlan({
    items: [{ productCategory: "global", quantity: input.quantity }],
    requestedMode: input.requestedMode,
    capacity: input.capacity ?? { workingWeekdays: [], blackoutDates: [] },
    now: input.now,
  });
  const standardWorkingDays = plan.paths[0]?.workingDays ?? DELIVERY_DAYS;
  const workingDays = input.requestedMode === "rush"
    ? Math.max(RUSH_DELIVERY_DAYS, standardWorkingDays - DELIVERY_DAYS + RUSH_DELIVERY_DAYS)
    : standardWorkingDays;
  return {
    estimatedDispatchDate: `${input.requestedMode === "rush" && plan.earliestRushDate ? plan.earliestRushDate : plan.earliestStandardDate}T00:00:00.000Z`,
    usedFallback: plan.usedFallback,
    workingDays,
  };
}
