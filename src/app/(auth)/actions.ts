"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { actionError, actionSuccess, type AuthActionState } from "@/lib/auth/constants";
import { safeInternalPath } from "@/lib/auth/redirects";
import { isStaffSurface } from "@/lib/config/appSurface";
import { isFeatureEnabled } from "@/lib/config/featureFlags";
import { clearMedusaToken, medusaRequest, setMedusaToken } from "@/lib/medusa/client";
import { MedusaApiError } from "@/lib/medusa/types";

const email = z.string().trim().email().max(320).transform((value) => value.toLowerCase());
const password = z.string().min(8).max(128);
const name = z.string().trim().min(1).max(80);
const fields = (formData: FormData) => Object.fromEntries(formData.entries());
const emailSchema = z.object({ email });
const loginSchema = z.object({ email, password, next: z.string().optional(), portal: z.literal("staff") });
const emailOtpSchema = z.object({ email, challengeId: z.string().min(1), token: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"), next: z.string().optional() });
const minimalOnboardingSchema = z.object({ firstName: name, lastName: name, consent: z.literal("on"), next: z.string().optional() });

function validationError(error: z.ZodError) {
  return actionError("Check the highlighted fields and try again.", error.flatten().fieldErrors);
}

function apiMessage(error: unknown, fallback: string): string {
  if (error instanceof MedusaApiError && error.code === "OTP_EXPIRED") return "This code has expired. Request a new one.";
  return fallback;
}

export async function loginAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (!isFeatureEnabled("STAFF_PORTAL_ENABLED") || !isStaffSurface()) return actionError("Staff access is not enabled on this application.");
  const parsed = loginSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);
  try {
    const result = await medusaRequest<{ token?: string }>("/auth/user/emailpass", { method: "POST", body: { email: parsed.data.email, password: parsed.data.password }, actor: "public" });
    if (!result.token) return actionError("Unable to sign in with those staff credentials.");
    await setMedusaToken("staff", result.token);
  } catch (error) {
    return actionError(apiMessage(error, "Unable to sign in with those staff credentials."));
  }
  redirect(safeInternalPath(parsed.data.next, "/orders"));
}

export async function requestCustomerOtpAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (!isFeatureEnabled("NEXT_PUBLIC_ACCOUNTS_ENABLED") || isStaffSurface()) return actionError("Customer account access is not enabled here.");
  const parsed = emailSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);
  try {
    const result = await medusaRequest<{ challengeId?: string; testCode?: string }>("/store/garmops/otp/request", { method: "POST", body: { email: parsed.data.email }, actor: "public" });
    if (!result.challengeId) return actionError("We could not send a sign-in code. Please try again.");
    return actionSuccess("If that email can receive customer sign-in codes, one is on its way.", { verificationEmail: parsed.data.email, challengeId: result.challengeId, testCode: process.env.NODE_ENV !== "production" && process.env.GARMOPS_E2E === "true" ? result.testCode : undefined });
  } catch (error) {
    return actionError(apiMessage(error, "We could not send a sign-in code. Please try again."));
  }
}

export async function verifyCustomerOtpAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (!isFeatureEnabled("NEXT_PUBLIC_ACCOUNTS_ENABLED") || isStaffSurface()) return actionError("Customer account access is not enabled here.");
  const parsed = emailOtpSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);
  try {
    const result = await medusaRequest<{ token?: string }>("/auth/customer/emailotp", { method: "POST", body: { email: parsed.data.email, challengeId: parsed.data.challengeId, code: parsed.data.token }, actor: "public" });
    if (!result.token) return actionError("That code could not be verified. Try again.");
    await setMedusaToken("customer", result.token);
  } catch (error) {
    return actionError(apiMessage(error, "That code could not be verified. Try again."));
  }
  return actionSuccess("You’re signed in.", {
    destination: safeInternalPath(parsed.data.next, "/account/orders"),
  });
}

export async function forgotPasswordAction(_state: AuthActionState, _formData: FormData): Promise<AuthActionState> {
  void _state; void _formData;
  return actionError("Staff password recovery is managed by Medusa administration. Contact your Founder.");
}

export async function resendVerificationAction(_state: AuthActionState, _formData: FormData): Promise<AuthActionState> {
  void _state; void _formData;
  return actionSuccess("Use a fresh login code from the customer sign-in screen.");
}

export async function resetPasswordAction(_state: AuthActionState, _formData: FormData): Promise<AuthActionState> {
  void _state; void _formData;
  return actionError("Password recovery is managed by Medusa administration.");
}

export async function completeMinimalCustomerOnboardingAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = minimalOnboardingSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);
  return actionSuccess("Your account is ready.", { destination: safeInternalPath(parsed.data.next, "/account/orders") });
}

export async function logoutAction() {
  try { await medusaRequest("/auth/session", { method: "DELETE", actor: "customer" }); } catch { /* local token clearing is still required */ }
  await clearMedusaToken("customer");
  redirect("/login");
}

export async function staffLogoutAction() {
  try { await medusaRequest("/foundry/session", { method: "DELETE", actor: "staff" }); } catch { /* local token clearing is still required */ }
  await clearMedusaToken("staff");
  redirect("/login");
}
