"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCustomer } from "@/lib/auth/guards";

export async function createPrivacyRequest(formData: FormData) {
  const parsed = z.object({ requestType: z.enum(["export", "delete", "correction"]), note: z.string().trim().max(2000) }).safeParse({ requestType: formData.get("requestType"), note: formData.get("note") ?? "" });
  if (!parsed.success) return;
  const { user, supabase } = await requireCustomer("/account/privacy");
  const { error } = await supabase.from("privacy_requests").insert({ customer_user_id: user.id, request_type: parsed.data.requestType, customer_note: parsed.data.note || null });
  if (error) {
    console.error("Privacy request could not be saved", { userId: user.id, error: error.message });
    throw new Error("Your privacy request could not be submitted. Please try again.");
  }
  revalidatePath("/account/privacy");
}

export async function updateRecoveryPreference(formData: FormData) {
  const { user, supabase } = await requireCustomer("/account/privacy");
  const { error } = await supabase.from("customer_privacy_preferences").upsert({
    customer_user_id: user.id,
    recovery_messages_enabled: formData.get("recoveryMessages") === "on",
    updated_at: new Date().toISOString(),
  }, { onConflict: "customer_user_id" });
  if (error) {
    console.error("Privacy preference could not be saved", { userId: user.id, error: error.message });
    throw new Error("Your communication preference could not be saved. Please try again.");
  }
  revalidatePath("/account/privacy");
}
