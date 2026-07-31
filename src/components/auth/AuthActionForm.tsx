"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  INITIAL_AUTH_ACTION_STATE,
  type AuthActionState,
} from "@/lib/auth/constants";
import {
  completeOnboardingAction,
  forgotPasswordAction,
  loginAction,
  registerAction,
  resendVerificationAction,
  resetPasswordAction,
} from "@/app/(auth)/actions";
import TurnstileWidget from "@/components/auth/TurnstileWidget";

type Variant =
  | "login"
  | "register"
  | "forgot"
  | "verify"
  | "reset"
  | "onboarding";

type Defaults = Partial<Record<string, string>>;

const actions: Record<
  Variant,
  (state: AuthActionState, formData: FormData) => Promise<AuthActionState>
> = {
  login: loginAction,
  register: registerAction,
  forgot: forgotPasswordAction,
  verify: resendVerificationAction,
  reset: resetPasswordAction,
  onboarding: completeOnboardingAction,
};

const inputClass =
  "techpack-control w-full rounded-[4px] border px-4 py-3 text-sm outline-none transition-colors focus:!border-[var(--color-accent)]";

function Field({
  label,
  name,
  type = "text",
  required,
  autoComplete,
  defaultValue,
  placeholder,
  prefix,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  defaultValue?: string;
  placeholder?: string;
  prefix?: string;
  error?: string[];
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-black/55">
      {label}
      {prefix ? (
        <div className="flex">
          <span className="techpack-control inline-flex items-center rounded-r-none border-r-0 px-3 text-sm text-black/55">
            {prefix}
          </span>
          <input
            className={`${inputClass} rounded-l-none`}
            name={name}
            type={type}
            required={required}
            autoComplete={autoComplete}
            defaultValue={defaultValue}
            placeholder={placeholder}
            inputMode={type === "tel" ? "numeric" : undefined}
            aria-invalid={Boolean(error?.length)}
          />
        </div>
      ) : (
        <input
          className={inputClass}
          name={name}
          type={type}
          required={required}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          placeholder={placeholder}
          aria-invalid={Boolean(error?.length)}
        />
      )}
      {error?.[0] ? <span className="normal-case text-red-700">{error[0]}</span> : null}
    </label>
  );
}

function CompanyFields({
  defaults,
  errors,
  includeAdditionalFields = true,
}: {
  defaults: Defaults;
  errors?: Record<string, string[]>;
  includeAdditionalFields?: boolean;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name *" name="firstName" required autoComplete="given-name" defaultValue={defaults.firstName} error={errors?.firstName} />
        <Field label="Last name *" name="lastName" required autoComplete="family-name" defaultValue={defaults.lastName} error={errors?.lastName} />
      </div>
      <Field label="Company *" name="companyName" required autoComplete="organization" defaultValue={defaults.companyName} error={errors?.companyName} />
      <Field
        label={includeAdditionalFields ? "Phone in E.164 format *" : "Phone *"}
        name="phone"
        type="tel"
        required
        autoComplete="tel"
        placeholder={includeAdditionalFields ? "+919876543210" : "9876543210"}
        defaultValue={defaults.phone}
        prefix={includeAdditionalFields ? undefined : "+91"}
        error={errors?.phone}
      />
      {includeAdditionalFields ? (
        <>
          <Field label="Industry" name="industry" defaultValue={defaults.industry} error={errors?.industry} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Department" name="department" autoComplete="organization-title" defaultValue={defaults.department} error={errors?.department} />
            <Field label="Job title" name="jobTitle" autoComplete="organization-title" defaultValue={defaults.jobTitle} error={errors?.jobTitle} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Website" name="website" type="url" autoComplete="url" placeholder="https://company.com" defaultValue={defaults.website} error={errors?.website} />
            <Field label="GSTIN" name="gstin" defaultValue={defaults.gstin} error={errors?.gstin} />
          </div>
        </>
      ) : null}
      <label className="flex items-start gap-3 text-sm text-black/60">
        <input className="mt-1" type="checkbox" name="terms" required />
        <span>
          I accept the <Link href="/terms" className="text-[var(--color-accent)] hover:underline">Terms of Service</Link>.
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm text-black/60">
        <input className="mt-1" type="checkbox" name="privacy" required />
        <span>
          I acknowledge the <Link href="/privacy" className="text-[var(--color-accent)] hover:underline">Privacy Policy</Link>.
        </span>
      </label>
    </>
  );
}

export default function AuthActionForm({
  variant,
  next,
  defaults = {},
}: {
  variant: Variant;
  next?: string;
  defaults?: Defaults;
}) {
  const [state, formAction, pending] = useActionState(
    actions[variant],
    INITIAL_AUTH_ACTION_STATE,
  );
  const errors = state.fieldErrors;
  const protectionAction =
    variant === "forgot"
      ? "forgot_password"
      : variant === "verify"
        ? "resend_verification"
        : variant;
  const protectedByTurnstile = ["login", "register", "forgot", "verify"].includes(
    variant,
  );
  const buttonText: Record<Variant, string> = {
    login: "Sign in",
    register: "Create account",
    forgot: "Send recovery link",
    verify: "Resend verification",
    reset: "Set new password",
    onboarding: "Create company workspace",
  };

  return (
    <form action={formAction} className="flex flex-col gap-4" aria-busy={pending}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {variant === "login" ? (
        <>
          <Field label="Email" name="email" type="email" required autoComplete="email" error={errors?.email} />
          <Field label="Password" name="password" type="password" required autoComplete="current-password" error={errors?.password} />
          <div className="text-right">
            <Link href="/forgot-password" className="text-xs text-[var(--color-accent)] hover:underline">
              Forgot password?
            </Link>
          </div>
        </>
      ) : null}

      {variant === "register" ? (
        <>
          <CompanyFields defaults={defaults} errors={errors} includeAdditionalFields={false} />
          <Field label="Email" name="email" type="email" required autoComplete="email" error={errors?.email} />
          <Field label="Password" name="password" type="password" required autoComplete="new-password" error={errors?.password} />
        </>
      ) : null}

      {variant === "onboarding" ? (
        <CompanyFields defaults={defaults} errors={errors} />
      ) : null}

      {variant === "forgot" || variant === "verify" ? (
        <Field label="Work email *" name="email" type="email" required autoComplete="email" error={errors?.email} />
      ) : null}

      {variant === "reset" ? (
        <>
          <Field label="New password *" name="password" type="password" required autoComplete="new-password" error={errors?.password} />
          <Field label="Confirm password *" name="confirmPassword" type="password" required autoComplete="new-password" error={errors?.confirmPassword} />
        </>
      ) : null}

      {protectedByTurnstile ? (
        <TurnstileWidget action={protectionAction} resetToken={state.resetToken} />
      ) : null}

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-[4px] border px-4 py-3 text-sm ${
            state.status === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-[4px] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-dark)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Working…" : buttonText[variant]}
      </button>
    </form>
  );
}
