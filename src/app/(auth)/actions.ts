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
const optionalPassword = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  password.optional(),
);
const name = z.string().trim().min(1).max(80);
const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(maximum).optional().transform((value) => value || null),
  );

const loginSchema = z.object({
  email,
  password: optionalPassword,
  next: z.string().optional(),
  portal: z.enum(["customer", "staff"]).default("customer"),
});

const customerIdentitySchema = {
  firstName: name,
  lastName: name,
};

const accountType = z.enum(["personal", "business"]).default("business");
const optionalCompanyField = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(200).optional(),
);
const optionalBusinessField = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(120).optional(),
);

const registrationPhone = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{10,15}$/, "Enter a valid mobile number")
  .transform((value) => value.startsWith("+") ? value : `+91${value}`);

const onboardingPhone = z
  .string()
  .trim()
  .regex(/^\+[1-9][0-9]{7,14}$/);

const registerSchema = z.object({
  ...customerIdentitySchema,
  accountType,
  email,
  password: optionalPassword,
  phone: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    registrationPhone.optional(),
  ),
  companyName: optionalCompanyField,
  industry: optionalBusinessField,
  department: optionalBusinessField,
  gstin: optionalBusinessField,
  terms: z.literal("on"),
  privacy: z.literal("on"),
}).superRefine((value, context) => {
  if (value.accountType !== "business") return;
  for (const field of ["companyName", "industry", "department", "gstin"] as const) {
    if (!value[field]) context.addIssue({ code: "custom", path: [field], message: "Required for business registration" });
  }
});

const onboardingSchema = z.object({
  ...customerIdentitySchema,
  accountType,
  phone: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    onboardingPhone.optional(),
  ),
  companyName: optionalCompanyField,
  department: optionalText(120),
  jobTitle: optionalText(120),
  website: z
    .preprocess(
      (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
      z.string().trim().max(500).optional(),
    )
    .refine((value) => !value || z.url().safeParse(value).success, "Enter a valid URL")
    .transform((value) => value || null),
  gstin: z
    .preprocess(
      (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
      z.string().trim().toUpperCase().optional(),
    )
    .refine(
      (value) =>
        !value || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value),
        "Enter a valid GSTIN",
      )
      .transform((value) => value || null),
    industry: optionalText(120),
    terms: z.literal("on"),
    privacy: z.literal("on"),
  }).superRefine((value, context) => {
    if (value.accountType !== "business") return;
    for (const field of ["companyName", "industry", "department", "gstin"] as const) {
      if (!value[field]) context.addIssue({ code: "custom", path: [field], message: "Required for business account" });
    }
  });
const emailSchema = z.object({ email });
const emailOtpSchema = z.object({
  email,
  token: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  next: z.string().optional(),
  portal: z.enum(["customer", "staff"]).default("customer"),
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
  if (!parsed.data.password && parsed.data.portal === "staff") {
    return actionError("Staff sign-in requires a password and authenticator MFA.");
  }
  if (!parsed.data.password) {
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: authCallbackUrl(parsed.data.next ?? "/account"),
      },
    });
    if (otpError) return actionError("We could not send a sign-in code. Please try again.");
    return actionSuccess(
      "We sent a one-time sign-in code to your email. Enter it to continue.",
      { verificationEmail: parsed.data.email },
    );
  }
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

export async function verifyEmailOtpAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!authEnabled()) return actionError("Account access is not enabled yet.");
  const parsed = emailOtpSchema.safeParse(fields(formData));
  if (!parsed.success) return validationError(parsed.error);

  try {
    const rate = await consumeAuthRateLimit("login", parsed.data.email);
    if (!rate.allowed) {
      return actionError("Too many code attempts. Please wait before trying again.");
    }
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
  const metadata = {
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    account_type: parsed.data.accountType,
    company_name: parsed.data.companyName ?? "",
    phone: parsed.data.phone ?? "",
    industry: parsed.data.industry ?? "",
    department: parsed.data.department ?? "",
    gstin: parsed.data.gstin ?? "",
  };
  const result = parsed.data.password
    ? await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: { emailRedirectTo: authCallbackUrl("/account/onboarding"), data: metadata },
      })
    : await supabase.auth.signInWithOtp({
        email: parsed.data.email,
        options: { shouldCreateUser: true, emailRedirectTo: authCallbackUrl("/account/onboarding"), data: metadata },
      });

  if (result.error) {
    return actionError("We could not complete registration. Please try again.");
  }
  return actionSuccess(
    parsed.data.password
      ? "We sent a verification link. Open it to verify your email, then sign in to finish setting up your workspace."
      : "We sent a one-time code to your email. Enter it to verify your email and continue setting up your workspace.",
    { verificationEmail: parsed.data.email },
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
    p_phone: parsed.data.phone ?? "",
    p_job_title: parsed.data.jobTitle ?? "",
    p_department: parsed.data.department ?? "",
    p_company_name: parsed.data.companyName ?? "Personal workspace",
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
