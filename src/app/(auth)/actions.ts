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
import { authCallbackUrl, safeInternalPath } from "@/lib/auth/redirects";
import {
  consumeAuthRateLimit,
  requestIpAddress,
} from "@/lib/auth/rateLimit";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { isFeatureEnabled } from "@/lib/config/featureFlags";
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

const optionalCompanyField = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(200).optional(),
);
const emailSchema = z.object({ email });
const emailOtpSchema = z.object({
  email,
  token: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  next: z.string().optional(),
  portal: z.enum(["customer", "staff"]).default("customer"),
});
const minimalOnboardingSchema = z.object({
  firstName: name,
  lastName: name,
  companyName: optionalCompanyField,
  consent: z.literal("on"),
  next: z.string().optional(),
});
const resetSchema = z
  .object({
    password,
    confirmPassword: password,
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

function fields(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function validationError(error: z.ZodError) {
  return actionError("Check the highlighted fields and try again.", error.flatten().fieldErrors);
}

function authEnabled() {
  return (
    isFeatureEnabled("NEXT_PUBLIC_ACCOUNTS_ENABLED") ||
    isFeatureEnabled("STAFF_PORTAL_ENABLED")
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
  const rate = await consumeAuthRateLimit(scope, subject);
  return rate.allowed;
}

async function destinationAfterLogin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  requestedNext: string,
  portal: "customer" | "staff",
) {
  const { data: staff } = await supabase
    .from("staff_members")
    .select("active, invited_at, activated_at, deactivated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (staff) {
    if (portal === "customer") {
      const { data: customerMembership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (customerMembership) return safeInternalPath(requestedNext, "/account");
      await supabase.auth.signOut();
      return "/auth/error?code=STAFF_LOGIN_REQUIRED";
    }
    if (staff.deactivated_at) {
      await supabase.auth.signOut();
      return "/auth/error?code=STAFF_ACCESS_DENIED";
    }
    if (!staff.active) {
      await supabase.auth.signOut();
      return "/auth/error?code=STAFF_ACCESS_DENIED";
    }
    await supabase.rpc("record_staff_login");
    return "/staff/orders";
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return membership ? safeInternalPath(requestedNext, "/account") : "/account/onboarding";
}

export async function loginAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!authEnabled()) return actionError("Account access is not enabled yet.");
  const parsed = loginSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);

  try {
    if (!(await passPublicProtection("login", parsed.data.email, formData))) {
      return actionError("Security verification failed. Please try again.");
    }
  } catch {
    return actionError("Sign in is temporarily unavailable. Please try again.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    return actionError("Unable to sign in with those credentials.");
  }

  const destination = await destinationAfterLogin(
    supabase,
    data.user.id,
    parsed.data.next ?? "/account",
    parsed.data.portal,
  );
  redirect(destination);
}

/** Customer-only email OTP request. Staff uses password sign-in. */
export async function requestCustomerOtpAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isFeatureEnabled("NEXT_PUBLIC_ACCOUNTS_ENABLED")) {
    return actionError("Account access is not enabled yet.");
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: authCallbackUrl(safeInternalPath(formData.get("next"), "/account/orders")),
    },
  });
  if (error) return actionError("We could not send a sign-in code. Please try again.");
  return actionSuccess("If that email can receive sign-in codes, one is on its way.", {
    verificationEmail: parsed.data.email,
  });
}

export async function verifyCustomerOtpAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isFeatureEnabled("NEXT_PUBLIC_ACCOUNTS_ENABLED")) {
    return actionError("Account access is not enabled yet.");
  }
  const parsed = emailOtpSchema.safeParse({ ...fields(formData), portal: "customer" });
  if (!parsed.success) return validationError(parsed.error);

  try {
    const rate = await consumeAuthRateLimit("login", parsed.data.email);
    if (!rate.allowed) return actionError("Too many code attempts. Please wait before trying again.");
  } catch {
    return actionError("Code verification is temporarily unavailable.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });
  if (error || !data.user) return actionError("That sign-in code is invalid or expired.");

  const destination = await destinationAfterLogin(
    supabase,
    data.user.id,
    parsed.data.next ?? "/account/orders",
    "customer",
  );
  if (destination.startsWith("/auth/error")) {
    return actionError("Use the staff sign-in page to access a staff account.");
  }
  return actionSuccess("Signed in.", {
    destination: safeInternalPath(destination, "/account/orders"),
    requiresOnboarding: destination === "/account/onboarding",
  });
}

export async function forgotPasswordAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!authEnabled()) return actionError("Account access is not enabled yet.");
  const parsed = emailSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);

  try {
    if (
      !(await passPublicProtection(
        "forgot_password",
        parsed.data.email,
        formData,
      ))
    ) {
      return actionError("Security verification failed. Please try again.");
    }
  } catch {
    return actionError("Password recovery is temporarily unavailable.");
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: authCallbackUrl("/reset-password"),
  });
  return actionSuccess(
    "If an account exists for that email, a recovery link is on its way.",
  );
}

export async function resendVerificationAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!authEnabled()) return actionError("Account access is not enabled yet.");
  const parsed = emailSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);

  try {
    if (
      !(await passPublicProtection(
        "resend_verification",
        parsed.data.email,
        formData,
      ))
    ) {
      return actionError("Security verification failed. Please try again.");
    }
  } catch {
    return actionError("Email verification is temporarily unavailable.");
  }

  const supabase = await createClient();
  await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: authCallbackUrl("/account/onboarding") },
  });
  return actionSuccess(
    "If verification is pending, a fresh link has been sent.",
  );
}

export async function resetPasswordAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!authEnabled()) return actionError("Account access is not enabled yet.");
  const parsed = resetSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return actionError("This recovery link is no longer valid.");

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return actionError("We could not update your password.");

  const destination = await destinationAfterLogin(
    supabase,
    userData.user.id,
    "/account",
    "customer",
  );
  redirect(destination);
}

export async function completeMinimalCustomerOnboardingAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isFeatureEnabled("NEXT_PUBLIC_ACCOUNTS_ENABLED")) {
    return actionError("Customer accounts are not enabled yet.");
  }
  const parsed = minimalOnboardingSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.email_confirmed_at) {
    return actionError("Verify your email before continuing.");
  }
  const generatedCompanyName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim() + " customer";
  const { error } = await supabase.rpc("complete_customer_onboarding", {
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_phone: "",
    p_job_title: "",
    p_department: "",
    p_company_name: parsed.data.companyName ?? generatedCompanyName,
    p_website: "",
    p_gstin: "",
    p_industry: "",
    p_terms_version: TERMS_VERSION,
    p_privacy_version: PRIVACY_VERSION,
  });
  if (error) return actionError("We could not finish setting up your account. Please try again.");
  return actionSuccess("Your account is ready.", {
    destination: safeInternalPath(parsed.data.next, "/account/orders"),
  });
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
