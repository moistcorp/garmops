"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/auth/guards";

async function founderContext() {
  const context = await requireStaffPermission("view_raw_payments");
  if (context.role !== "founder") throw new Error("Founder access required");
  return context;
}

export async function saveWorkingDaysAction(formData: FormData) {
  const context = await founderContext();
  const rows = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    is_working: formData.getAll("weekday").includes(String(weekday)),
    updated_at: new Date().toISOString(),
  }));
  const { error } = await context.supabase.from("production_working_days").upsert(rows, { onConflict: "weekday" });
  if (error) throw new Error("Working days could not be saved");
  revalidatePath("/analytics");
}

export async function addBlackoutDateAction(formData: FormData) {
  const parsed = z.object({ date: z.string().date(), note: z.string().trim().max(300).optional() }).safeParse({
    date: formData.get("date"), note: formData.get("note") || undefined,
  });
  if (!parsed.success) throw new Error("Check the blackout date");
  const context = await founderContext();
  const { error } = await context.supabase.from("production_blackout_dates").upsert({ ...parsed.data, active: true }, { onConflict: "date" });
  if (error) throw new Error("Blackout date could not be saved");
  revalidatePath("/analytics");
}

export async function addCapacityRuleAction(formData: FormData) {
  const parsed = z.object({
    effective_from: z.string().date(), daily_unit_capacity: z.coerce.number().int().positive(),
    product_category: z.string().trim().max(100).optional(),
    technique: z.enum(["screen_print", "dtf", "reflective_print"]).optional(),
  }).safeParse({ effective_from: formData.get("effectiveFrom"), daily_unit_capacity: formData.get("dailyUnitCapacity"), product_category: formData.get("productCategory") || undefined, technique: formData.get("technique") || undefined });
  if (!parsed.success) throw new Error("Check the capacity rule");
  const context = await founderContext();
  const { error } = await context.supabase.from("production_capacity_rules").insert({ ...parsed.data, product_category: parsed.data.product_category ?? null, technique: parsed.data.technique ?? null });
  if (error) throw new Error("Capacity rule could not be saved");
  revalidatePath("/analytics");
}

export async function addLeadTimeRuleAction(formData: FormData) {
  const parsed = z.object({
    product_category: z.string().trim().max(100).optional(), technique: z.enum(["screen_print", "dtf", "reflective_print"]).optional(),
    custom_dye_extra_days: z.coerce.number().int().min(0), setup_buffer_days: z.coerce.number().int().min(0),
    qc_dispatch_buffer_days: z.coerce.number().int().min(0), rush_eligible: z.coerce.boolean(),
  }).safeParse({ product_category: formData.get("productCategory") || undefined, technique: formData.get("technique") || undefined, custom_dye_extra_days: formData.get("customDyeExtraDays"), setup_buffer_days: formData.get("setupBufferDays"), qc_dispatch_buffer_days: formData.get("qcDispatchBufferDays"), rush_eligible: formData.get("rushEligible") === "on" });
  if (!parsed.success) throw new Error("Check the lead-time rule");
  const context = await founderContext();
  const { error } = await context.supabase.from("production_lead_time_rules").insert({ ...parsed.data, product_category: parsed.data.product_category ?? null, technique: parsed.data.technique ?? null });
  if (error) throw new Error("Lead-time rule could not be saved");
  revalidatePath("/analytics");
}
