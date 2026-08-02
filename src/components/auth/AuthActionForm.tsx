"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  forgotPasswordAction,
  loginAction,
  resendVerificationAction,
  resetPasswordAction,
} from "@/app/(auth)/actions";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import {
  INITIAL_AUTH_ACTION_STATE,
  type AuthActionState,
} from "@/lib/auth/constants";

type Variant = "login" | "forgot" | "verify" | "reset";

const actions: Record<
  Variant,
  (state: AuthActionState, formData: FormData) => Promise<AuthActionState>
> = {
  login: loginAction,
  forgot: forgotPasswordAction,
  verify: resendVerificationAction,
  reset: resetPasswordAction,
};

const inputClass =
  "techpack-control w-full rounded-[4px] border px-4 py-3 text-sm outline-none transition-colors focus:!border-[var(--color-accent)]";

function Field({
  label,
  name,
  type = "text",
  required,
  autoComplete,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  error?: string[];
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-black/55">
      {label}
      <input
        className={inputClass}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error?.length)}
      />
      {error?.[0] ? (
        <span className="normal-case text-red-700">{error[0]}</span>
      ) : null}
    </label>
  );
}

export default function AuthActionForm({
  variant,
  next,
  portal = "staff",
}: {
  variant: Variant;
  next?: string;
  portal?: "staff";
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
  const protectedByTurnstile = ["login", "forgot", "verify"].includes(
    variant,
  );
  const buttonText: Record<Variant, string> = {
    login: "Sign in",
    forgot: "Send recovery link",
    verify: "Resend verification",
    reset: "Set new password",
  };

  return (
    <form action={formAction} className="flex flex-col gap-4" aria-busy={pending}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {variant === "login" ? (
        <>
          <input type="hidden" name="portal" value={portal} />
          <Field
            label="Email"
            name="email"
            type="email"
            required
            autoComplete="email"
            error={errors?.email}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            error={errors?.password}
          />
          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </>
      ) : null}

      {variant === "forgot" || variant === "verify" ? (
        <Field
          label="Work email *"
          name="email"
          type="email"
          required
          autoComplete="email"
          error={errors?.email}
        />
      ) : null}

      {variant === "reset" ? (
        <>
          <Field
            label="New password *"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            error={errors?.password}
          />
          <Field
            label="Confirm password *"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            error={errors?.confirmPassword}
          />
        </>
      ) : null}

      {protectedByTurnstile ? (
        <TurnstileWidget
          action={protectionAction}
          resetToken={state.resetToken}
        />
      ) : null}

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          data-tone={state.status === "error" ? "error" : "success"}
          className="techpack-notice px-4 py-3 text-sm"
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
