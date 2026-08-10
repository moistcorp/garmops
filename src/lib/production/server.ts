import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  estimateProductionPlan,
  estimateProductionWindow,
  type ProductionCartItem,
  type ProductionPlan,
  type ProductionWindow,
} from "./estimate";

function indiaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export async function estimateProductionPlanFromDatabase(input: {
  items: readonly ProductionCartItem[];
  requestedMode: "rush" | "standard" | "flexible";
  requestedDate?: string;
}): Promise<ProductionPlan> {
  const admin = createAdminClient();
  const today = indiaToday();
  const [working, blackouts, capacity, lead, committed] = await Promise.all([
    admin.from("production_working_days").select("weekday,is_working"),
    admin.from("production_blackout_dates").select("date").eq("active", true).gte("date", today),
    admin.from("production_capacity_rules")
      .select("daily_unit_capacity,product_category,technique,effective_from")
      .eq("active", true)
      .lte("effective_from", today)
      .order("effective_from", { ascending: false }),
    admin.from("production_lead_time_rules")
      .select("product_category,technique,custom_dye_extra_days,setup_buffer_days,qc_dispatch_buffer_days,rush_eligible,created_at")
      .eq("active", true)
      .order("created_at", { ascending: false }),
    admin.from("order_items")
      .select("quantity,orders!inner(status)")
      .not("orders.status", "in", "(delivered,cancelled,refund_pending,refunded)"),
  ]);
  if (working.error || blackouts.error || capacity.error || lead.error || committed.error) {
    throw new Error("Capacity configuration unavailable");
  }

  const plan = estimateProductionPlan({
    ...input,
    capacity: {
      workingWeekdays: working.data?.filter((row) => row.is_working).map((row) => row.weekday) ?? [],
      blackoutDates: blackouts.data?.map((row) => row.date) ?? [],
      capacityRules: (capacity.data ?? []).map((row) => ({
        productCategory: row.product_category,
        technique: row.technique,
        dailyUnitCapacity: Number(row.daily_unit_capacity),
        effectiveFrom: row.effective_from,
      })),
      leadTimeRules: (lead.data ?? []).map((row) => ({
        productCategory: row.product_category,
        technique: row.technique,
        customDyeExtraDays: Number(row.custom_dye_extra_days),
        setupBufferDays: Number(row.setup_buffer_days),
        qcDispatchBufferDays: Number(row.qc_dispatch_buffer_days),
        rushEligible: row.rush_eligible,
      })),
      committedUnits: committed.data?.reduce((sum, row) => sum + Number(row.quantity), 0) ?? 0,
    },
  });
  return plan;
}

export async function estimateProductionWindowFromDatabase(input: {
  quantity: number;
  requestedMode: "rush" | "standard" | "flexible";
}): Promise<ProductionWindow> {
  try {
    const plan = await estimateProductionPlanFromDatabase({
      items: [{ productCategory: "global", quantity: input.quantity }],
      requestedMode: input.requestedMode,
    });
    const modeDate = input.requestedMode === "rush" && plan.earliestRushDate
      ? plan.earliestRushDate
      : plan.earliestStandardDate;
    return {
      estimatedDispatchDate: `${modeDate}T00:00:00.000Z`,
      usedFallback: plan.usedFallback,
      workingDays: plan.paths[0]?.workingDays ?? 0,
    };
  } catch {
    // Historical order finalization must remain durable if operations data is
    // temporarily unavailable. Checkout uses the plan function directly and
    // therefore fails closed before PayU rather than using this fallback.
    return estimateProductionWindow(input);
  }
}
