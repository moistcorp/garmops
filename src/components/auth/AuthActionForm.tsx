"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
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
  const [selectedAccountType, setSelectedAccountType] = useState<"personal" | "business">(
    defaults.accountType === "personal" ? "personal" : "business",
  );

  return (
    <>
      <input type="hidden" name="accountType" value={selectedAccountType} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name *" name="firstName" required autoComplete="given-name" defaultValue={defaults.firstName} error={errors?.firstName} />
        <Field label="Last name *" name="lastName" required autoComplete="family-name" defaultValue={defaults.lastName} error={errors?.lastName} />
      </div>
      <fieldset>
        <legend className="text-xs font-medium uppercase tracking-wide text-black/55">Account type *</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-[4px] border border-[var(--color-rule)] p-1">
          {(["personal", "business"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedAccountType(type)}
              aria-pressed={selectedAccountType === type}
              className={`rounded-[3px] px-3 py-2.5 text-sm capitalize transition-colors ${selectedAccountType === type ? "bg-[var(--color-accent)] text-white" : "text-black/55 hover:bg-black/5"}`}
            >
              {type}
            </button>
          ))}
        </div>
      </fieldset>
      {selectedAccountType === "business" ? (
        <Field label="Company *" name="companyName" required autoComplete="organization" defaultValue={defaults.companyName} error={errors?.companyName} />
      ) : null}
      <Field
        label={includeAdditionalFields ? "Phone in E.164 format" : "Phone"}
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder={includeAdditionalFields ? "+919876543210" : "9876543210"}
        defaultValue={defaults.phone}
        prefix={includeAdditionalFields ? undefined : "+91"}
        error={errors?.phone}
      />
      {includeAdditionalFields && selectedAccountType === "business" ? (
        <>
          <Field label="Industry *" name="industry" required defaultValue={defaults.industry} error={errors?.industry} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Department *" name="department" required autoComplete="organization-title" defaultValue={defaults.department} error={errors?.department} />
            <Field label="Job title" name="jobTitle" autoComplete="organization-title" defaultValue={defaults.jobTitle} error={errors?.jobTitle} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Website" name="website" type="url" autoComplete="url" placeholder="https://company.com" defaultValue={defaults.website} error={errors?.website} />
            <Field label="GSTIN *" name="gstin" required defaultValue={defaults.gstin} error={errors?.gstin} />
          </div>
        </>
      ) : null}
      {selectedAccountType === "business" ? (
        <p className="rounded-[4px] border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 p-3 text-xs leading-relaxed text-black/60">
          Business registration requires your company name, industry, department, and GSTIN.
        </p>
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
  portal = "customer",
}: {
  variant: Variant;
  next?: string;
  defaults?: Defaults;
  portal?: "customer" | "staff";
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
  const registrationComplete = variant === "register" && state.status === "success";

  return (
    <form action={formAction} className="flex flex-col gap-4" aria-busy={pending}>
      {registrationComplete ? (
        <section className="rounded-[4px] border border-emerald-200 bg-emerald-50 p-5 text-emerald-950" role="status">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Next step</p>
          <h2 className="mt-2 text-xl font-semibold">Check your inbox</h2>
          <p className="mt-2 text-sm leading-relaxed">
            We sent a verification link to <strong>{state.verificationEmail ?? "your email address"}</strong>.
            Open the link, then return to <Link href="/login" className="font-medium underline">customer sign in</Link>.
          </p>
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-emerald-900/80">
            <li>Open the email from Garmops.</li>
            <li>Select “Verify work email”.</li>
            <li>Sign in and complete your company workspace setup.</li>
          </ol>
          <p className="mt-4 text-xs leading-relaxed text-emerald-900/70">
            Didn’t receive it? Check spam or use the <Link href="/verify-email" className="font-medium underline">resend verification</Link> page.
          </p>
          {process.env.NEXT_PUBLIC_APP_URL?.includes("localhost") ? (
            <p className="mt-3 border-t border-emerald-200 pt-3 text-xs leading-relaxed text-emerald-900/70">
              Local development email is captured in Supabase Mailpit at <a href="http://127.0.0.1:54324" target="_blank" rel="noreferrer" className="font-medium underline">127.0.0.1:54324</a>; it is not delivered to your external inbox.
            </p>
          ) : null}
        </section>
      ) : null}
      {!registrationComplete && next ? <input type="hidden" name="next" value={next} /> : null}
      {!registrationComplete && variant === "login" ? <input type="hidden" name="portal" value={portal} /> : null}
      {!registrationComplete && variant === "login" ? (
        <>
          <Field label="Email" name="email" type="email" required autoComplete="email" defaultValue={defaults.email} error={errors?.email} />
          <Field label={portal === "staff" ? "Password" : "Password (optional)"} name="password" type="password" required={portal === "staff"} autoComplete="current-password" error={errors?.password} />
          {portal === "customer" ? <p className="-mt-2 text-xs leading-relaxed text-black/45">Leave this blank to receive a one-time sign-in code by email.</p> : null}
          <div className="text-right">
            <Link href="/forgot-password" className="text-xs text-[var(--color-accent)] hover:underline">
              Forgot password?
            </Link>
          </div>
        </>
      ) : null}

      {!registrationComplete && variant === "register" ? (
        <>
          <CompanyFields defaults={defaults} errors={errors} />
          <Field label="Email" name="email" type="email" required autoComplete="email" error={errors?.email} />
          <Field label="Password" name="password" type="password" required autoComplete="new-password" error={errors?.password} />
        </>
      ) : null}

      {!registrationComplete && variant === "onboarding" ? (
        <CompanyFields defaults={defaults} errors={errors} />
      ) : null}

      {!registrationComplete && (variant === "forgot" || variant === "verify") ? (
        <Field label="Work email *" name="email" type="email" required autoComplete="email" error={errors?.email} />
      ) : null}

      {!registrationComplete && variant === "reset" ? (
        <>
          <Field label="New password *" name="password" type="password" required autoComplete="new-password" error={errors?.password} />
          <Field label="Confirm password *" name="confirmPassword" type="password" required autoComplete="new-password" error={errors?.confirmPassword} />
        </>
      ) : null}

      {!registrationComplete && protectedByTurnstile ? (
        <TurnstileWidget action={protectionAction} resetToken={state.resetToken} />
      ) : null}

      {!registrationComplete && state.message ? (
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

      {!registrationComplete ? <button
        type="submit"
        disabled={pending}
        className="rounded-[4px] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-dark)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Working…" : buttonText[variant]}
      </button> : null}
    </form>
  );
}
