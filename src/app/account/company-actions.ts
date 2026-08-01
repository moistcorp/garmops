"use server";

import { revalidatePath } from "next/cache";

import { requireOrganizationMember } from "@/lib/auth/guards";
import {
  addressMutation,
  companyDetailsSchema,
  savedAddressSchema,
} from "@/lib/account/companyDetails";
import {
  staffActionError,
  staffActionSuccess,
  type StaffActionState,
} from "@/lib/staff/actionState";

function formValues(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function invalidForm() {
  return staffActionError("Check the highlighted details and try again.");
}

export async function updateCompanyDetailsAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const parsed = companyDetailsSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalidForm();

  const context = await requireOrganizationMember("/account/company");
  if (context.membership.role !== "owner") {
    return staffActionError("Only the company owner can change company details.");
  }

  const { data, error } = await context.supabase
    .from("organizations")
    .update({
      legal_name: parsed.data.companyName,
      display_name: parsed.data.companyName,
      gstin: parsed.data.gstin,
    })
    .eq("id", context.membership.organization_id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return staffActionError("Company details could not be saved.");
  }

  revalidatePath("/account/company");
  revalidatePath("/checkout");
  return staffActionSuccess("Company details saved.");
}

export async function saveBillingAddressAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const parsed = savedAddressSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalidForm();

  const context = await requireOrganizationMember("/account/company");
  if (!["owner", "buyer", "finance"].includes(context.membership.role)) {
    return staffActionError("You do not have permission to change addresses.");
  }

  const organizationId = context.membership.organization_id;
  const { data: existing, error: existingError } = await context.supabase
    .from("addresses")
    .select("id, is_default_shipping")
    .eq("organization_id", organizationId)
    .eq("is_default_billing", true)
    .maybeSingle();
  if (existingError) return staffActionError("The billing address could not be loaded.");

  const values = {
    ...addressMutation(parsed.data),
    label: parsed.data.label ?? "Billing address",
    gstin: null,
    is_default_billing: true,
    is_default_shipping: parsed.data.useAsShipping,
  };

  if (values.is_default_shipping) {
    const unset = context.supabase
      .from("addresses")
      .update({ is_default_shipping: false })
      .eq("organization_id", organizationId)
      .eq("is_default_shipping", true);
    if (existing?.id) unset.neq("id", existing.id);
    const { error } = await unset;
    if (error) return staffActionError("The default shipping address could not be changed.");
  }

  const result = existing
    ? await context.supabase
        .from("addresses")
        .update(values)
        .eq("id", existing.id)
        .eq("organization_id", organizationId)
        .select("id")
        .maybeSingle()
    : await context.supabase
        .from("addresses")
        .insert({ ...values, organization_id: organizationId })
        .select("id")
        .maybeSingle();

  if (result.error || !result.data) {
    return staffActionError("The billing address could not be saved.");
  }

  revalidatePath("/account/company");
  revalidatePath("/checkout");
  return staffActionSuccess("Billing address saved.");
}

export async function saveShippingAddressAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const parsed = savedAddressSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalidForm();

  const context = await requireOrganizationMember("/account/company");
  if (!["owner", "buyer", "finance"].includes(context.membership.role)) {
    return staffActionError("You do not have permission to change addresses.");
  }

  const organizationId = context.membership.organization_id;
  const { data: currentAddress, error: currentError } = parsed.data.addressId
    ? await context.supabase
        .from("addresses")
        .select("id, is_default_shipping")
        .eq("id", parsed.data.addressId)
        .eq("organization_id", organizationId)
        .maybeSingle()
    : { data: null, error: null };
  if (currentError || (parsed.data.addressId && !currentAddress)) {
    return staffActionError("That shipping address is unavailable.");
  }

  const { data: currentDefault, error: defaultError } = await context.supabase
    .from("addresses")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_default_shipping", true)
    .maybeSingle();
  if (defaultError) return staffActionError("Shipping addresses could not be loaded.");

  const makeDefault =
    parsed.data.useAsShipping ||
    currentAddress?.is_default_shipping === true ||
    !currentDefault;
  if (makeDefault) {
    let unset = context.supabase
      .from("addresses")
      .update({ is_default_shipping: false })
      .eq("organization_id", organizationId)
      .eq("is_default_shipping", true);
    if (currentAddress?.id) unset = unset.neq("id", currentAddress.id);
    const { error } = await unset;
    if (error) return staffActionError("The default shipping address could not be changed.");
  }

  const values = {
    ...addressMutation(parsed.data),
    label: parsed.data.label ?? "Shipping address",
    is_default_shipping: makeDefault,
  };
  const result = currentAddress
    ? await context.supabase
        .from("addresses")
        .update(values)
        .eq("id", currentAddress.id)
        .eq("organization_id", organizationId)
        .select("id")
        .maybeSingle()
    : await context.supabase
        .from("addresses")
        .insert({
          ...values,
          organization_id: organizationId,
          is_default_billing: false,
        })
        .select("id")
        .maybeSingle();

  if (result.error || !result.data) {
    return staffActionError("The shipping address could not be saved.");
  }

  revalidatePath("/account/company");
  revalidatePath("/checkout");
  return staffActionSuccess(
    currentAddress ? "Shipping address updated." : "Shipping address added.",
  );
}
