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
const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => value || null);

const loginSchema = z.object({
  email,
  password,
  next: z.string().optional(),
  portal: z.enum(["customer", "staff"]).default("customer"),
});

const customerIdentitySchema = {
  firstName: name,
  lastName: name,
  companyName: z.string().trim().min(2).max(200),
};

const registrationPhone = z
  .string()
  .trim()
  .regex(/^[0-9]{10}$/, "Enter a 10-digit Indian mobile number")
  .transform((value) => `+91${value}`);

const onboardingPhone = z
  .string()
  .trim()
  .regex(/^\+[1-9][0-9]{7,14}$/);

const registerSchema = z.object({
  ...customerIdentitySchema,
  email,
  password,
  phone: registrationPhone,
  terms: z.literal("on"),
  privacy: z.literal("on"),
});

const onboardingSchema = z.object({
  ...customerIdentitySchema,
  phone: onboardingPhone,
  department: optionalText(120),
  jobTitle: optionalText(120),
  website: z
    .string()
    .trim()
    .max(500)
    .refine((value) => !value || z.url().safeParse(value).success, "Enter a valid URL")
    .transform((value) => value || null),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (value) =>
        !value || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value),
        "Enter a valid GSTIN",
      )
      .transform((value) => value || null),
    industry: optionalText(120),
    terms: z.literal("on"),
    privacy: z.literal("on"),
  });
const emailSchema = z.object({ email });
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
  scope: "register" | "login" | "forgot_password" | "resend_verification",
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
    const { data: assurance } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel === "aal2") {
      if (!staff.active && staff.invited_at && !staff.activated_at) {
        await supabase.rpc("activate_invited_staff");
      }
      await supabase.rpc("record_staff_login");
      return "/staff";
    }
    return assurance?.nextLevel === "aal2"
      ? "/staff/mfa/challenge"
      : "/staff/mfa/enrol";
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

export async function registerAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isFeatureEnabled("NEXT_PUBLIC_ACCOUNTS_ENABLED")) {
    return actionError("Customer registration is not enabled yet.");
  }
  const parsed = registerSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);

  try {
    if (!(await passPublicProtection("register", parsed.data.email, formData))) {
      return actionError("Security verification failed. Please try again.");
    }
  } catch (error) {
    console.error(
      "[registerAction] public protection failed:",
      error instanceof Error ? error.message : error,
    );
    return actionError("Registration is temporarily unavailable. Please try again.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: authCallbackUrl("/account/onboarding"),
      data: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        company_name: parsed.data.companyName,
        phone: parsed.data.phone,
      },
    },
  });

  if (error) {
    return actionError("We could not complete registration. Please try again.");
  }
  return actionSuccess(
    "Check your email for the verification link, then finish setting up your account.",
  );
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

export async function completeOnboardingAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isFeatureEnabled("NEXT_PUBLIC_ACCOUNTS_ENABLED")) {
    return actionError("Customer accounts are not enabled yet.");
  }
  const parsed = onboardingSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.email_confirmed_at) {
    return actionError("Verify your work email before creating the company.");
  }

  const { error } = await supabase.rpc("complete_customer_onboarding", {
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_phone: parsed.data.phone,
    p_job_title: parsed.data.jobTitle ?? "",
    p_department: parsed.data.department ?? "",
    p_company_name: parsed.data.companyName,
    p_website: parsed.data.website ?? "",
    p_gstin: parsed.data.gstin ?? "",
    p_industry: parsed.data.industry ?? "",
    p_terms_version: TERMS_VERSION,
    p_privacy_version: PRIVACY_VERSION,
  });
  if (error) {
    return actionError("We could not create the company workspace. Please try again.");
  }
  redirect("/account");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
