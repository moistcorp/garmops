"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  requestCustomerOtpAction,
  verifyCustomerOtpAction,
} from "@/app/(auth)/actions";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import { ActionFeedback } from "@/components/configurator/ActionFeedback";
import {
  INITIAL_AUTH_ACTION_STATE,
  type AuthActionState,
} from "@/lib/auth/constants";
import { createClient } from "@/lib/supabase/client";
import {
  AUTH_NEXT_COOKIE,
  AUTH_NEXT_COOKIE_MAX_AGE_SECONDS,
  authCallbackUrl,
  safeInternalPath,
} from "@/lib/auth/redirects";

type Step = "email" | "otp";

const inputClass =
  "techpack-control w-full rounded-[4px] border px-4 py-3 text-sm outline-none transition-colors focus:!border-[var(--color-accent)]";

function Message({ state }: { state: AuthActionState }) {
  if (!state.message) return null;
  return (
    <ActionFeedback
      tone={state.status === "error" ? "error" : "success"}
      title={state.message}
    />
  );
}

function AuthProgress({ step }: { step: Step }) {
  const activeIndex = step === "email" ? 0 : 1;
  const labels = ["Email", "Verify"];
  return (
    <ol
      className="mb-6 grid grid-cols-2 border border-[var(--color-rule)]"
      aria-label="Account access progress"
    >
      {labels.map((label, index) => (
        <li
          key={label}
          aria-current={index === activeIndex ? "step" : undefined}
          className={`border-r border-[var(--color-rule)] px-2 py-2 text-center font-mono text-[8px] font-semibold uppercase tracking-[0.08em] last:border-r-0 ${
            index === activeIndex
              ? "bg-[var(--color-accent)] text-white"
              : index < activeIndex
                ? "bg-[var(--color-cream-soft)] text-[var(--color-navy)]"
                : "text-[var(--text-primary)]/35"
          }`}
        >
          {String(index + 1).padStart(2, "0")} {label}
        </li>
      ))}
    </ol>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.71-.06-1.4-.19-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z"
      />
      <path
        fill="currentColor"
        d="M12 22c2.7 0 4.98-.9 6.64-2.43l-3.24-2.53c-.9.6-2.04.96-3.4.96-2.6 0-4.8-1.76-5.6-4.12H3.05v2.6A10 10 0 0 0 12 22Z"
      />
      <path
        fill="currentColor"
        d="M6.4 13.88A6 6 0 0 1 6.08 12c0-.65.11-1.28.32-1.88v-2.6H3.05A10 10 0 0 0 2 12c0 1.61.38 3.14 1.05 4.48l3.35-2.6Z"
      />
      <path
        fill="currentColor"
        d="M12 6c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.95 5.52l3.35 2.6C7.2 7.76 9.4 6 12 6Z"
      />
    </svg>
  );
}

export default function CustomerAuthFlow({
  next = "/account/orders",
  onAuthenticated,
  initialEmail = "",
  emailLocked = false,
  allowGoogle = true,
}: {
  next?: string;
  onAuthenticated?: (destination: string) => void;
  initialEmail?: string;
  emailLocked?: boolean;
  allowGoogle?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(() => initialEmail.trim().toLowerCase());
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [now, setNow] = useState(0);
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState("");

  const finish = (destination: string) => {
    if (onAuthenticated) onAuthenticated(destination);
    else {
      router.refresh();
      router.push(destination);
    }
  };

  const [requestState, requestAction, requesting] = useActionState(
    async (state: AuthActionState, formData: FormData) => {
      const result = await requestCustomerOtpAction(state, formData);
      if (result.status === "success" && result.verificationEmail) {
        setEmail(result.verificationEmail);
        setStep("otp");
        setResendAvailableAt(Date.now() + 30_000);
      }
      return result;
    },
    INITIAL_AUTH_ACTION_STATE,
  );

  const [verifyState, verifyAction, verifying] = useActionState(
    async (state: AuthActionState, formData: FormData) => {
      const result = await verifyCustomerOtpAction(state, formData);
      if (result.status === "success" && result.destination) {
        finish(result.destination);
      }
      return result;
    },
    INITIAL_AUTH_ACTION_STATE,
  );

  useEffect(() => {
    if (step !== "otp" || resendAvailableAt <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [step, resendAvailableAt]);

  const cooldown = Math.max(
    0,
    Math.ceil((resendAvailableAt - now) / 1000),
  );

  const signInWithGoogle = async () => {
    setGooglePending(true);
    setGoogleError("");
    try {
      const destination = safeInternalPath(next, "/account/orders");
      document.cookie = [
        `${AUTH_NEXT_COOKIE}=${encodeURIComponent(destination)}`,
        `Max-Age=${AUTH_NEXT_COOKIE_MAX_AGE_SECONDS}`,
        "Path=/",
        "SameSite=Lax",
        window.location.protocol === "https:" ? "Secure" : "",
      ].filter(Boolean).join("; ");
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          // Use the configured canonical callback rather than the browser's
          // current hostname. Supabase falls back to its Site URL when an
          // unlisted www/apex variant is supplied. Keep `next` in the URL as
          // well as the cookie so the checkout survives hostname changes.
          redirectTo: authCallbackUrl(destination),
        },
      });
      if (error) throw error;
    } catch (error) {
      document.cookie = `${AUTH_NEXT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
      setGooglePending(false);
      setGoogleError(
        error instanceof Error
          ? error.message
          : "Google sign-in could not be started.",
      );
    }
  };

  if (step === "otp") {
    return (
      <div className="space-y-4">
        <AuthProgress step="otp" />
        <form
          action={verifyAction}
          className="flex flex-col gap-4"
          aria-busy={verifying}
        >
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <p className="rounded-[4px] border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 p-4 text-sm text-black/65">
            We sent a six-digit code to <strong>{email}</strong>.
          </p>
          <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-black/55">
            One-time code
            <input
              className={inputClass}
              name="token"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoComplete="one-time-code"
              autoFocus
            />
          </label>
          <Message state={verifyState} />
          <button
            type="submit"
            disabled={verifying}
            className="min-h-11 rounded-[4px] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {verifying ? "Verifying…" : "Verify"}
          </button>
        </form>
        <form action={requestAction} className="flex flex-col gap-3">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <TurnstileWidget
            action="login"
            resetToken={requestState.resetToken}
          />
          <button
            type="submit"
            disabled={requesting || cooldown > 0}
            className="min-h-11 text-left text-sm text-[var(--color-accent)] hover:underline disabled:text-black/40"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </form>
        {!emailLocked ? (
          <button
            type="button"
            onClick={() => setStep("email")}
            className="min-h-11 text-sm text-[var(--color-accent)] hover:underline"
          >
            {allowGoogle ? "Change email or use Google" : "Change email"}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <AuthProgress step="email" />
      <form
        action={requestAction}
        className="flex flex-col gap-4"
        aria-busy={requesting}
      >
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-black/55">
          Email address
          <input
            className={inputClass}
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            readOnly={emailLocked}
            required
            autoComplete="email"
            autoFocus={!emailLocked}
            placeholder="you@example.com"
          />
        </label>
        <TurnstileWidget action="login" resetToken={requestState.resetToken} />
        <Message state={requestState} />
        {googleError && (
          <ActionFeedback tone="error" title={googleError} />
        )}
        <button
          type="submit"
          disabled={requesting || googlePending}
          className="min-h-11 rounded-[4px] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {requesting ? "Sending code…" : "Continue with email"}
        </button>
      </form>

      {allowGoogle ? (
        <>
          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-[var(--color-rule)]" />
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-black/35">
              or
            </span>
            <span className="h-px flex-1 bg-[var(--color-rule)]" />
          </div>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={googlePending || requesting}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[4px] border border-[var(--color-rule)] bg-white px-6 py-3 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--color-accent)] disabled:opacity-60"
          >
            <GoogleMark />
            {googlePending ? "Opening Google…" : "Continue with Google"}
          </button>
        </>
      ) : null}

      <p className="mt-5 text-xs leading-relaxed text-black/45">
        By continuing, you agree to the{" "}
        <Link
          href="/terms"
          className="text-[var(--color-accent)] hover:underline"
        >
          Terms of Service
        </Link>{" "}
        and acknowledge the{" "}
        <Link
          href="/privacy"
          className="text-[var(--color-accent)] hover:underline"
        >
          Privacy Policy
        </Link>
        . Missing contact or billing details can be completed during Delivery.
      </p>
    </div>
  );
}
