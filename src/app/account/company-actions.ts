"use server";
import { revalidatePath } from "next/cache";
import { requireCustomer } from "@/lib/auth/guards";
import { companyDetailsSchema, savedAddressSchema } from "@/lib/account/companyDetails";
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
  const parsed = savedAddressSchema.safeParse(formValues(formData)); if (!parsed.success) return invalidForm(); const context = await requireCustomer("/account/billing");
  const result = await context.supabase.rpc("save_customer_address", {
    p_address_id: parsed.data.addressId ?? (null as unknown as string),
    p_role: "billing",
    p_label: parsed.data.label ?? "Billing address",
    p_contact_name: parsed.data.contactName ?? (null as unknown as string),
    p_phone: parsed.data.phone ?? (null as unknown as string),
    p_line1: parsed.data.line1,
    p_line2: parsed.data.line2 ?? (null as unknown as string),
    p_landmark: parsed.data.landmark ?? (null as unknown as string),
    p_city: parsed.data.city,
    p_state: parsed.data.state,
    p_postal_code: parsed.data.postalCode,
    p_country_code: "IN",
    p_use_as_shipping: parsed.data.useAsShipping,
  });
  if (result.error || !result.data) return staffActionError("The billing address could not be saved."); revalidateBilling(); return staffActionSuccess("Billing address saved.");
}

export async function saveShippingAddressAction(_state: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const parsed = savedAddressSchema.safeParse(formValues(formData)); if (!parsed.success) return invalidForm(); const context = await requireCustomer("/account/billing");
  const result = await context.supabase.rpc("save_customer_address", {
    p_address_id: parsed.data.addressId ?? (null as unknown as string),
    p_role: "shipping",
    p_label: parsed.data.label ?? "Shipping address",
    p_contact_name: parsed.data.contactName ?? (null as unknown as string),
    p_phone: parsed.data.phone ?? (null as unknown as string),
    p_line1: parsed.data.line1,
    p_line2: parsed.data.line2 ?? (null as unknown as string),
    p_landmark: parsed.data.landmark ?? (null as unknown as string),
    p_city: parsed.data.city,
    p_state: parsed.data.state,
    p_postal_code: parsed.data.postalCode,
    p_country_code: "IN",
    p_use_as_shipping: parsed.data.useAsShipping,
  });
  if (result.error || !result.data) return staffActionError("The shipping address could not be saved."); revalidateBilling(); return staffActionSuccess("Shipping address saved.");
}
