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
const emailSchema = z.object({ email, "cf-turnstile-response": z.string().trim().optional() });
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
  let requiresEnrollment = false;
  try {
    const result = await medusaRequest<{ token?: string; mfa_required?: boolean; mfa_challenge?: { id: string; methods?: string[] } }>("/auth/user/emailpass", { method: "POST", body: { email: parsed.data.email, password: parsed.data.password }, actor: "public" });
    if (!result.token) return actionError("Unable to sign in with those staff credentials.");
    await setMedusaToken("staff", result.token);
    if (result.mfa_required && result.mfa_challenge) return actionSuccess("Enter the authenticator code to continue.", { mfaChallengeId: result.mfa_challenge.id, mfaMethods: result.mfa_challenge.methods ?? ["totp"] });
    const pending = await medusaRequest<{ mfaRequired?: boolean }>("/foundry/session?allowMfaPending=true", { actor: "staff" });
    requiresEnrollment = Boolean(pending.mfaRequired);
  } catch (error) {
    return actionError(apiMessage(error, "Unable to sign in with those staff credentials."));
  }
  if (requiresEnrollment) redirect(`/settings/security?next=${encodeURIComponent(safeInternalPath(parsed.data.next, "/orders"))}`);
  redirect(safeInternalPath(parsed.data.next, "/orders"));
}

export async function verifyStaffMfaAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const challengeId = String(formData.get("challengeId") ?? "");
  const code = String(formData.get("code") ?? "");
  const next = safeInternalPath(String(formData.get("next") ?? "/orders"), "/orders");
  if (!challengeId || !/^\d{6}$/.test(code)) return actionError("Enter the 6-digit authenticator code.");
  try {
    const result = await medusaRequest<{ token?: string }>(`/auth/mfa/challenges/${encodeURIComponent(challengeId)}/verify`, { method: "POST", body: { method: "totp", code }, actor: "staff" });
    if (!result.token) return actionError("The authenticator code was not accepted.");
    await setMedusaToken("staff", result.token);
  } catch (error) { return actionError(apiMessage(error, "The authenticator code was not accepted.")); }
  redirect(next);
}

export async function startStaffMfaAction(_state: AuthActionState, _formData: FormData): Promise<AuthActionState> {
  try {
    const result = await medusaRequest<{ mfa_factor?: { id: string }; secret?: string; otpauth_url?: string }>("/auth/mfa/factors", { method: "POST", body: { provider: "totp", label: "Foundry authenticator", issuer: "Garmops" }, actor: "staff" });
    if (!result.mfa_factor?.id || !result.secret) return actionError("MFA enrollment could not be started.");
    return actionSuccess("Scan or enter the secret in your authenticator app, then verify it below.", { mfaFactorId: result.mfa_factor.id, mfaSecret: result.secret, mfaOtpAuthUrl: result.otpauth_url });
  } catch (error) { return actionError(apiMessage(error, "MFA enrollment could not be started.")); }
}

export async function verifyStaffMfaEnrollmentAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const factorId = String(formData.get("factorId") ?? "");
  const code = String(formData.get("code") ?? "");
  if (!factorId || !/^\d{6}$/.test(code)) return actionError("Enter the 6-digit authenticator code.");
  try {
    await medusaRequest(`/auth/mfa/factors/${encodeURIComponent(factorId)}/verify`, { method: "POST", body: { code }, actor: "staff" });
  } catch (error) { return actionError(apiMessage(error, "The authenticator code was not accepted.")); }
  redirect("/login?next=%2Forders");
}

export async function requestCustomerOtpAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (!isFeatureEnabled("NEXT_PUBLIC_ACCOUNTS_ENABLED") || isStaffSurface()) return actionError("Customer account access is not enabled here.");
  const parsed = emailSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);
  try {
    const result = await medusaRequest<{ challengeId?: string; testCode?: string }>("/store/garmops/otp/request", { method: "POST", body: { email: parsed.data.email, turnstileToken: parsed.data["cf-turnstile-response"] }, actor: "public" });
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
