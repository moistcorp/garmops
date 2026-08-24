"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleAlert } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  requestCustomerOtpAction,
  verifyCustomerOtpAction,
} from "@/app/(auth)/actions";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import {
  INITIAL_AUTH_ACTION_STATE,
  type AuthActionState,
} from "@/lib/auth/constants";
import {
  AUTH_NEXT_COOKIE,
  AUTH_NEXT_COOKIE_MAX_AGE_SECONDS,
  safeInternalPath,
} from "@/lib/auth/redirects";

type Step = "email" | "otp";

const inputClass =
  "techpack-control w-full rounded-sm border px-4 py-3 text-sm outline-none transition-[border-color,background-color] duration-150";
const primaryButtonClass =
  "min-h-11 rounded-sm bg-(--color-accent) px-6 py-3 text-sm font-semibold text-white transition-[background-color,opacity,transform] duration-150 hover:bg-(--color-accent-dark) active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100 motion-reduce:transform-none";

function InlineError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-1.5 text-xs font-medium leading-relaxed text-[#A62D2D]"
    >
      <CircleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

function stateError(state: AuthActionState, field?: string): string | undefined {
  if (field && state.fieldErrors?.[field]?.[0]) return state.fieldErrors[field][0];
  return state.status === "error" ? state.message : undefined;
}

function AuthProgress({ step }: { step: Step }) {
  const activeIndex = step === "email" ? 0 : 1;
  const labels = ["Email", "6-digit code"];

  return (
    <ol className="mb-5 flex items-center" aria-label="Sign-in progress">
      {labels.map((label, index) => {
        const complete = index < activeIndex;
        const active = index === activeIndex;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={`flex min-w-0 items-center gap-2 ${index === 0 ? "flex-1" : "shrink-0"}`}
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] font-semibold ${
                complete || active
                  ? "border-(--color-accent) bg-(--color-accent) text-white"
                  : "border-(--color-control-border) text-(--text-primary)/38"
              }`}
              aria-hidden="true"
            >
              {complete ? <Check size={12} strokeWidth={2.8} /> : index + 1}
            </span>
            <span
              className={`truncate text-xs font-semibold ${
                complete || active ? "text-(--text-primary)" : "text-(--text-primary)/42"
              }`}
            >
              {label}
            </span>
            {index === 0 ? (
              <span className="mx-2 h-px min-w-5 flex-1 bg-(--color-control-border)" aria-hidden="true" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function OtpCodeInput({
  value,
  onChange,
  error,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled: boolean;
}) {
  const slots = Array.from({ length: 6 }, (_, index) => value[index] ?? "");

  return (
    <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-wide text-black/58">
      One-time code
      <div className="relative grid grid-cols-6 gap-2 rounded-sm">
        <input
          name="token"
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoComplete="one-time-code"
          autoFocus
          disabled={disabled}
          aria-label="One-time code"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "customer-otp-error" : undefined}
          className="absolute inset-0 z-10 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none disabled:cursor-not-allowed"
        />
        {slots.map((digit, index) => (
          <span
            key={index}
            aria-hidden="true"
            className={`flex h-12 items-center justify-center rounded-sm border bg-white text-lg font-semibold text-(--text-primary) ${
              error
                ? "border-[#A62D2D]/55"
                : index === Math.min(value.length, 5)
                  ? "border-(--color-accent)/55"
                  : "border-(--color-control-border)"
            }`}
          >
            {digit}
          </span>
        ))}
      </div>
      <InlineError id="customer-otp-error" message={error} />
    </label>
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
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(() => initialEmail.trim().toLowerCase());
  const [otp, setOtp] = useState("");
  const [emailSecurityToken, setEmailSecurityToken] = useState("");
  const [resendSecurityToken, setResendSecurityToken] = useState("");
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [now, setNow] = useState(0);
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [challengeId, setChallengeId] = useState("");

  const finish = (destination: string) => {
    if (onAuthenticated) onAuthenticated(destination);
    else router.replace(destination);
  };

  const [requestState, requestAction, requesting] = useActionState(
    async (state: AuthActionState, formData: FormData) => {
      const result = await requestCustomerOtpAction(state, formData);
      if (result.status === "success" && result.verificationEmail) {
        const nextNow = Date.now();
        setEmail(result.verificationEmail);
        setChallengeId(result.challengeId ?? "");
        setOtp("");
        setStep("otp");
        setNow(nextNow);
        setResendAvailableAt(nextNow + 30_000);
      }
      return result;
    },
    INITIAL_AUTH_ACTION_STATE,
  );

  const [verifyState, verifyAction, verifying] = useActionState(
    async (state: AuthActionState, formData: FormData) => {
      const result = await verifyCustomerOtpAction(state, formData);
      if (result.status === "success" && result.destination) finish(result.destination);
      return result;
    },
    INITIAL_AUTH_ACTION_STATE,
  );

  useEffect(() => {
    if (step !== "email" || emailLocked || window.matchMedia("(max-width: 639px)").matches) return;
    const frame = window.requestAnimationFrame(() => emailInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [emailLocked, step]);

  useEffect(() => {
    if (step !== "otp" || resendAvailableAt <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [step, resendAvailableAt]);

  const cooldown = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));

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
      window.location.assign(`/api/auth/customer/google?next=${encodeURIComponent(destination)}`);
    } catch (error) {
      document.cookie = `${AUTH_NEXT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
      setGooglePending(false);
      setGoogleError(error instanceof Error ? error.message : "Google sign-in could not be started.");
    }
  };

  const changeEmail = () => {
    setStep("email");
    setOtp("");
    setEmailSecurityToken("");
    setResendSecurityToken("");
  };

  if (step === "otp") {
    const otpError = stateError(verifyState, "token");
    const resendError = stateError(requestState);

    return (
      <div>
        <AuthProgress step="otp" />
        <div className="mb-5 rounded-sm border border-(--color-accent)/18 bg-(--color-accent)/5 px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-(--text-primary)/48">Code sent to</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <strong className="min-w-0 truncate text-sm text-(--text-primary)">{email}</strong>
            {!emailLocked ? (
              <button type="button" onClick={changeEmail} className="shrink-0 text-xs font-semibold text-(--color-accent) hover:underline">
                Change
              </button>
            ) : null}
          </div>
        </div>

        {requestState.testCode ? (
          <span data-testid="e2e-test-otp" className="sr-only">{requestState.testCode}</span>
        ) : null}

        <form action={verifyAction} className="flex flex-col gap-4" aria-busy={verifying}>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="challengeId" value={challengeId} />
          <input type="hidden" name="next" value={next} />
          <OtpCodeInput value={otp} onChange={setOtp} error={otpError} disabled={verifying} />
          <button type="submit" disabled={verifying || otp.length !== 6} className={primaryButtonClass}>
            {verifying ? "Verifying…" : "Verify and continue →"}
          </button>
        </form>

        <div className="my-5 h-px bg-(--color-rule)" />

        <form action={requestAction} className="flex flex-col gap-3" aria-busy={requesting}>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <TurnstileWidget
            action="login"
            resetToken={requestState.resetToken}
            onToken={setResendSecurityToken}
          />
          <InlineError message={resendError} />
          <button
            type="submit"
            disabled={requesting || cooldown > 0 || !resendSecurityToken}
            className="min-h-10 self-start text-sm font-semibold text-(--color-accent) hover:underline disabled:cursor-not-allowed disabled:text-black/38"
          >
            {requesting
              ? "Sending a new code…"
              : cooldown > 0
                ? `Resend code in ${cooldown}s`
                : !resendSecurityToken
                  ? "Preparing resend…"
                  : "Resend code"}
          </button>
        </form>
      </div>
    );
  }

  const emailError = stateError(requestState, "email");

  return (
    <div>
      <AuthProgress step="email" />
      <form action={requestAction} className="flex flex-col gap-4" aria-busy={requesting}>
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-black/58">
          Email address
          <input
            ref={emailInputRef}
            className={inputClass}
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            readOnly={emailLocked}
            required
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(emailError)}
            aria-describedby={`customer-email-help${emailError ? " customer-email-error" : ""}`}
          />
        </label>
        <p id="customer-email-help" className="-mt-2 text-xs leading-relaxed text-(--text-primary)/52">
          We’ll send a six-digit code. No password needed.
        </p>
        <InlineError id="customer-email-error" message={emailError} />
        <TurnstileWidget
          action="login"
          resetToken={requestState.resetToken}
          onToken={setEmailSecurityToken}
        />
        <InlineError message={googleError} />
        <button
          type="submit"
          disabled={requesting || googlePending || !emailSecurityToken}
          className={primaryButtonClass}
        >
          {requesting
            ? "Sending code…"
            : !emailSecurityToken
              ? "Complete security check to continue"
              : "Email me a code →"}
        </button>
      </form>

      {allowGoogle ? (
        <>
          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-(--color-rule)" />
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-black/38">or</span>
            <span className="h-px flex-1 bg-(--color-rule)" />
          </div>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={googlePending || requesting}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-sm border border-(--color-rule) bg-white px-6 py-3 text-sm font-medium text-(--text-primary) transition-[border-color,background-color,opacity,transform] duration-150 hover:border-(--color-accent) active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100 motion-reduce:transform-none"
          >
            <GoogleMark />
            {googlePending ? "Opening Google…" : "Continue with Google"}
          </button>
        </>
      ) : null}

      <p className="mt-5 text-xs leading-relaxed text-black/58">
        By continuing, you agree to the{" "}
        <Link href="/terms" className="font-medium text-(--color-accent) hover:underline">
          Terms of Service
        </Link>{" "}
        and acknowledge the{" "}
        <Link href="/privacy" className="font-medium text-(--color-accent) hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
