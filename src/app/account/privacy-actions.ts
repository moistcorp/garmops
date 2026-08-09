"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCustomer } from "@/lib/auth/guards";

export async function createPrivacyRequest(formData: FormData) {
  const parsed = z.object({ requestType: z.enum(["export", "delete", "correction"]), note: z.string().trim().max(2000) }).safeParse({ requestType: formData.get("requestType"), note: formData.get("note") ?? "" });
  if (!parsed.success) return;
  const { user, supabase } = await requireCustomer("/account/privacy");
  await supabase.from("privacy_requests").insert({ customer_user_id: user.id, request_type: parsed.data.requestType, customer_note: parsed.data.note || null });
  revalidatePath("/account/privacy");
}

export async function updateRecoveryPreference(formData: FormData) {
  const { user, supabase } = await requireCustomer("/account/privacy");
  await supabase.from("customer_privacy_preferences").upsert({
    customer_user_id: user.id,
    recovery_messages_enabled: formData.get("recoveryMessages") === "on",
    updated_at: new Date().toISOString(),
  }, { onConflict: "customer_user_id" });
  revalidatePath("/account/privacy");
}
