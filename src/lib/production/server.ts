import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateProductionWindow, type ProductionWindow } from "./estimate";

export async function estimateProductionWindowFromDatabase(input: {
  quantity: number;
  requestedMode: "rush" | "standard" | "flexible";
}): Promise<ProductionWindow> {
  const admin = createAdminClient();
  try {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    const [working, blackouts, capacity, lead, committed] = await Promise.all([
      admin.from("production_working_days").select("weekday,is_working"),
      admin.from("production_blackout_dates").select("date").eq("active", true).gte("date", today),
      admin.from("production_capacity_rules").select("daily_unit_capacity").eq("active", true).is("product_category", null).is("technique", null).lte("effective_from", today).order("effective_from", { ascending: false }).limit(1).maybeSingle(),
      admin.from("production_lead_time_rules").select("custom_dye_extra_days,setup_buffer_days,qc_dispatch_buffer_days,rush_eligible").eq("active", true).is("product_category", null).is("technique", null).limit(1).maybeSingle(),
      admin.from("order_items").select("quantity,orders!inner(status)").not("orders.status", "in", "(delivered,cancelled,refunded)"),
    ]);
    if (working.error || blackouts.error || capacity.error || lead.error || committed.error) throw new Error("Capacity configuration unavailable");
    const workingWeekdays = working.data?.filter((row) => row.is_working).map((row) => row.weekday) ?? [];
    const committedUnits = committed.data?.reduce((sum, row) => sum + Number(row.quantity), 0) ?? 0;
    const leadDays = lead.data ? lead.data.custom_dye_extra_days + lead.data.setup_buffer_days + lead.data.qc_dispatch_buffer_days : 0;
    return estimateProductionWindow({
      ...input,
      capacity: {
        workingWeekdays,
        blackoutDates: blackouts.data?.map((row) => row.date) ?? [],
        dailyUnitCapacity: capacity.data?.daily_unit_capacity,
        committedUnits,
        extraWorkingDays: leadDays,
      },
    });
  } catch {
    return estimateProductionWindow(input);
  }
}
