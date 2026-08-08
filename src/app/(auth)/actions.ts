"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  PRIVACY_VERSION,
  TERMS_VERSION,
  actionError,
  actionSuccess,
  type AuthActionState,
} from "@/lib/auth/constants";
import { ensureCustomerAccount } from "@/lib/auth/ensurePersonalCustomerAccount";
import { authCallbackUrl, safeInternalPath } from "@/lib/auth/redirects";
import { consumeAuthRateLimit, requestIpAddress } from "@/lib/auth/rateLimit";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { isStaffSurface } from "@/lib/config/appSurface";
import { isFeatureEnabled } from "@/lib/config/featureFlags";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const email = z.string().trim().email().max(320).transform((value) => value.toLowerCase());
const password = z.string().min(8).max(128);
const name = z.string().trim().min(1).max(80);

const loginSchema = z.object({
  email,
  password,
  next: z.string().optional(),
  portal: z.literal("staff"),
});
const emailSchema = z.object({ email });
const emailOtpSchema = z.object({
  email,
  token: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  next: z.string().optional(),
});
const minimalOnboardingSchema = z.object({
  firstName: name,
  lastName: name,
  consent: z.literal("on"),
  next: z.string().optional(),
});
const resetSchema = z
  .object({ password, confirmPassword: password })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

function fields(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function validationError(error: z.ZodError) {
  return actionError(
    "Check the highlighted fields and try again.",
    error.flatten().fieldErrors,
  );
}

async function passPublicProtection(
  scope: "login" | "forgot_password" | "resend_verification",
  subject: string,
  formData: FormData,
) {
  const ip = await requestIpAddress();
  const verified = await verifyTurnstile(
    formData.get("cf-turnstile-response"),
    scope,
    ip,
  );
  if (!verified) return false;
  return (await consumeAuthRateLimit(scope, subject)).allowed;
}

async function principalForEmail(normalizedEmail: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("account_principals")
    .select("account_type, active, user_id")
    .eq("normalized_email", normalizedEmail)
    .maybeSingle();
  return data as
    | { account_type: "customer" | "staff"; active: boolean; user_id: string | null }
    | null;
}

async function staffDestination(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestedNext: string,
) {
  const { data, error } = await supabase.rpc("get_staff_access_context");
  const staff = data?.[0];
  if (error || !staff?.active) {
    await supabase.auth.signOut();
    return "/auth/error?code=STAFF_ACCESS_DENIED";
  }
  await supabase.rpc("record_staff_login");
  const next = safeInternalPath(requestedNext, "/orders");
  return staff.must_use_mfa && !staff.mfa_satisfied
    ? `/settings/security?next=${encodeURIComponent(next)}`
    : next;
}

export async function loginAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isFeatureEnabled("STAFF_PORTAL_ENABLED") || !isStaffSurface()) {
    return actionError("Staff access is not enabled on this application.");
  }
  const parsed = loginSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);

  try {
    if (!(await passPublicProtection("login", parsed.data.email, formData))) {
      return actionError("Security verification failed. Please try again.");
    }
  } catch {
    return actionError("Sign in is temporarily unavailable. Please try again.");
  }

  const principal = await principalForEmail(parsed.data.email);
  if (!principal || principal.account_type !== "staff" || !principal.active) {
    return actionError("Unable to sign in with those staff credentials.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    return actionError("Unable to sign in with those staff credentials.");
  }

  redirect(await staffDestination(supabase, parsed.data.next ?? "/orders"));
}

/** Customer-only email OTP. Staff-reserved emails receive the same generic UI
 * response but no customer OTP is sent. */
export async function requestCustomerOtpAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isFeatureEnabled("NEXT_PUBLIC_ACCOUNTS_ENABLED") || isStaffSurface()) {
    return actionError("Customer account access is not enabled here.");
  }
  const parsed = emailSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);

  try {
    if (!(await passPublicProtection("login", parsed.data.email, formData))) {
      return actionError("Security verification failed. Please try again.");
    }
  } catch {
    return actionError("Sign in is temporarily unavailable. Please try again.");
  }

  const success = actionSuccess(
    "If that email can receive customer sign-in codes, one is on its way.",
    { verificationEmail: parsed.data.email },
  );
  const principal = await principalForEmail(parsed.data.email);
  if (principal && (principal.account_type === "staff" || !principal.active)) return success;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: authCallbackUrl(
        safeInternalPath(formData.get("next"), "/account/orders"),
      ),
    },
  });
  return error ? actionError("We could not send a sign-in code. Please try again.") : success;
}

export async function verifyCustomerOtpAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isFeatureEnabled("NEXT_PUBLIC_ACCOUNTS_ENABLED") || isStaffSurface()) {
    return actionError("Customer account access is not enabled here.");
  }
  const parsed = emailOtpSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);

  try {
    if (!(await consumeAuthRateLimit("login", parsed.data.email)).allowed) {
      return actionError("Too many code attempts. Please wait before trying again.");
    }
  } catch {
    return actionError("Code verification is temporarily unavailable.");
  }

  const principal = await principalForEmail(parsed.data.email);
  if (principal?.account_type === "staff") {
    return actionError("That email is reserved for Foundry staff access.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });
  if (error || !data.user) {
    return actionError(
      error?.code === "otp_expired"
        ? "This code has expired. Request a new one."
        : "That code couldn't be verified. Try again.",
    );
  }

  try {
    await ensureCustomerAccount(supabase);
  } catch (accountError) {
    console.error("Customer account provisioning failed after OTP verification", {
      userId: data.user.id,
      email: parsed.data.email,
      error: accountError instanceof Error ? accountError.message : "unknown",
    });
    await supabase.auth.signOut();
    return actionError("That email cannot be used for customer access.");
  }
  return actionSuccess("Signed in.", {
    destination: safeInternalPath(parsed.data.next, "/account/orders"),
  });
}

export async function forgotPasswordAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isFeatureEnabled("STAFF_PORTAL_ENABLED") || !isStaffSurface()) {
    return actionError("Password recovery is available only for Foundry staff.");
  }
  const parsed = emailSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);

  try {
    if (!(await passPublicProtection("forgot_password", parsed.data.email, formData))) {
      return actionError("Security verification failed. Please try again.");
    }
  } catch {
    return actionError("Password recovery is temporarily unavailable.");
  }

  const principal = await principalForEmail(parsed.data.email);
  if (principal?.account_type === "staff" && principal.active) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: authCallbackUrl("/reset-password"),
    });
  }
  return actionSuccess(
    "If an active staff account exists for that email, a recovery link is on its way.",
  );
}

export async function resendVerificationAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = emailSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);
  return actionSuccess("Use a fresh login code from the customer sign-in screen.");
}

export async function resetPasswordAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return actionError("This recovery link is no longer valid.");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return actionError("We could not update your password.");

  if (isStaffSurface()) {
    redirect(await staffDestination(supabase, "/orders"));
  }
  try {
    await ensureCustomerAccount(supabase);
  } catch {
    await supabase.auth.signOut();
    redirect("/auth/error?code=CUSTOMER_ACCESS_DENIED");
  }
  redirect("/account/orders");
}

export async function completeMinimalCustomerOnboardingAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = minimalOnboardingSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.email_confirmed_at) {
    return actionError("Verify your email before continuing.");
  }
  const { error } = await supabase.rpc("complete_customer_onboarding", {
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_phone: "",
    p_department: "",
    p_terms_version: TERMS_VERSION,
    p_privacy_version: PRIVACY_VERSION,
  });
  if (error) return actionError("We could not finish setting up your account.");
  return actionSuccess("Your account is ready.", {
    destination: safeInternalPath(parsed.data.next, "/account/orders"),
  });
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
