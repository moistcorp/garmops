"use server";
import { revalidatePath } from "next/cache";
import { requireCustomer } from "@/lib/auth/guards";
import { addressMutation, companyDetailsSchema, savedAddressSchema } from "@/lib/account/companyDetails";
import { staffActionError, staffActionSuccess, type StaffActionState } from "@/lib/staff/actionState";
function formValues(formData: FormData) { return Object.fromEntries(formData.entries()); }
function invalidForm() { return staffActionError("Check the highlighted details and try again."); }
function revalidateBilling() { revalidatePath("/account/billing"); revalidatePath("/checkout"); }

export async function updateCompanyDetailsAction(_state: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const parsed = companyDetailsSchema.safeParse(formValues(formData)); if (!parsed.success) return invalidForm();
  const context = await requireCustomer("/account/billing");
  const result = await context.supabase.from("customer_billing_profiles").upsert({ user_id: context.user.id, profile_type: parsed.data.gstin ? "business" : "personal", legal_business_name: parsed.data.companyName || null, gstin: parsed.data.gstin }, { onConflict: "user_id" }).select("id").maybeSingle();
  if (result.error || !result.data) return staffActionError("Billing details could not be saved."); revalidateBilling(); return staffActionSuccess("Billing details saved.");
}

export async function saveBillingAddressAction(_state: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const parsed = savedAddressSchema.safeParse(formValues(formData)); if (!parsed.success) return invalidForm(); const context = await requireCustomer("/account/billing"); const userId = context.user.id;
  const { data: existing, error } = await context.supabase.from("addresses").select("id").eq("user_id", userId).eq("is_default_billing", true).maybeSingle(); if (error) return staffActionError("The billing address could not be loaded.");
  if (parsed.data.useAsShipping) { const unset = await context.supabase.from("addresses").update({ is_default_shipping: false }).eq("user_id", userId).eq("is_default_shipping", true); if (unset.error) return staffActionError("The default shipping address could not be changed."); }
  const values = { ...addressMutation(parsed.data), label: parsed.data.label ?? "Billing address", is_default_billing: true, is_default_shipping: parsed.data.useAsShipping, user_id: userId };
  const result = existing ? await context.supabase.from("addresses").update(values).eq("id", existing.id).eq("user_id", userId).select("id").maybeSingle() : await context.supabase.from("addresses").insert(values).select("id").maybeSingle();
  if (result.error || !result.data) return staffActionError("The billing address could not be saved."); revalidateBilling(); return staffActionSuccess("Billing address saved.");
}

export async function saveShippingAddressAction(_state: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const parsed = savedAddressSchema.safeParse(formValues(formData)); if (!parsed.success) return invalidForm(); const context = await requireCustomer("/account/billing"); const userId = context.user.id;
  const current = parsed.data.addressId ? await context.supabase.from("addresses").select("id, is_default_shipping").eq("id", parsed.data.addressId).eq("user_id", userId).maybeSingle() : { data: null, error: null };
  if (current.error || (parsed.data.addressId && !current.data)) return staffActionError("That address is unavailable.");
  const defaultResult = await context.supabase.from("addresses").select("id").eq("user_id", userId).eq("is_default_shipping", true).maybeSingle(); if (defaultResult.error) return staffActionError("Shipping addresses could not be loaded.");
  const makeDefault = parsed.data.useAsShipping || current.data?.is_default_shipping === true || !defaultResult.data;
  if (makeDefault) { let query = context.supabase.from("addresses").update({ is_default_shipping: false }).eq("user_id", userId).eq("is_default_shipping", true); if (current.data?.id) query = query.neq("id", current.data.id); const unset = await query; if (unset.error) return staffActionError("The default shipping address could not be changed."); }
  const values = { ...addressMutation(parsed.data), label: parsed.data.label ?? "Shipping address", is_default_billing: false, is_default_shipping: makeDefault, user_id: userId };
  const result = current.data ? await context.supabase.from("addresses").update(values).eq("id", current.data.id).eq("user_id", userId).select("id").maybeSingle() : await context.supabase.from("addresses").insert(values).select("id").maybeSingle();
  if (result.error || !result.data) return staffActionError("The shipping address could not be saved."); revalidateBilling(); return staffActionSuccess("Shipping address saved.");
}
