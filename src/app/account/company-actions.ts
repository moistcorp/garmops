"use server";
import { staffActionError, type StaffActionState } from "@/lib/staff/actionState";
export async function updateCompanyDetailsAction(): Promise<StaffActionState> { return staffActionError("Billing profiles are recorded by Medusa during checkout."); }
export async function saveBillingAddressAction(): Promise<StaffActionState> { return staffActionError("Addresses are recorded by Medusa during checkout."); }
export async function saveShippingAddressAction(): Promise<StaffActionState> { return staffActionError("Addresses are recorded by Medusa during checkout."); }
