"use server";
import { revalidatePath } from "next/cache";
export async function createPrivacyRequest() { revalidatePath("/account/privacy"); }
export async function updateRecoveryPreference() { revalidatePath("/account/privacy"); }
