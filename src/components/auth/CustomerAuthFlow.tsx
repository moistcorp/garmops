"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  completeMinimalCustomerOnboardingAction,
  requestCustomerOtpAction,
  verifyCustomerOtpAction,
} from "@/app/(auth)/actions";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import { ActionFeedback } from "@/components/configurator/ActionFeedback";
import { INITIAL_AUTH_ACTION_STATE, type AuthActionState } from "@/lib/auth/constants";

type Step = "email" | "otp" | "onboarding";

const inputClass = "techpack-control w-full rounded-[4px] border px-4 py-3 text-sm outline-none transition-colors focus:!border-[var(--color-accent)]";

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
  const activeIndex = step === "email" ? 0 : step === "otp" ? 1 : 2;
  const labels = ["Email", "Verify", "Workspace"];
  return (
    <ol className="mb-6 grid grid-cols-3 border border-[var(--color-rule)]" aria-label="Account access progress">
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

export default function CustomerAuthFlow({
  next = "/account/orders",
  onAuthenticated,
}: {
  next?: string;
  onAuthenticated?: (destination: string) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [now, setNow] = useState(0);
  const finish = (destination: string) => {
    if (onAuthenticated) onAuthenticated(destination);
    else { router.refresh(); router.push(destination); }
  };
  const [requestState, requestAction, requesting] = useActionState(async (state: AuthActionState, formData: FormData) => {
    const result = await requestCustomerOtpAction(state, formData);
    if (result.status === "success" && result.verificationEmail) {
      setEmail(result.verificationEmail);
      setStep("otp");
      setResendAvailableAt(Date.now() + 30_000);
    }
    return result;
  }, INITIAL_AUTH_ACTION_STATE);
  const [verifyState, verifyAction, verifying] = useActionState(async (state: AuthActionState, formData: FormData) => {
    const result = await verifyCustomerOtpAction(state, formData);
    if (result.status === "success") {
      if (result.requiresOnboarding) setStep("onboarding");
      else if (result.destination) finish(result.destination);
    }
    return result;
  }, INITIAL_AUTH_ACTION_STATE);
  const [onboardingState, onboardingAction, onboardingPending] = useActionState(async (state: AuthActionState, formData: FormData) => {
    const result = await completeMinimalCustomerOnboardingAction(state, formData);
    if (result.status === "success" && result.destination) finish(result.destination);
    return result;
  }, INITIAL_AUTH_ACTION_STATE);

  useEffect(() => {
    if (step !== "otp" || resendAvailableAt <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [step, resendAvailableAt]);

  const cooldown = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));

  if (step === "onboarding") {
    return (
      <div>
        <AuthProgress step="onboarding" />
        <form action={onboardingAction} className="flex flex-col gap-4" aria-busy={onboardingPending}>
          <input type="hidden" name="next" value={next} />
          <p className="text-sm leading-relaxed text-black/55">A few details will help us keep your orders in one place.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-black/55">First name<input className={inputClass} name="firstName" required autoComplete="given-name" autoFocus /></label>
            <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-black/55">Last name<input className={inputClass} name="lastName" required autoComplete="family-name" /></label>
          </div>
          <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-black/55">Company name <span className="normal-case text-black/40">(optional)</span><input className={inputClass} name="companyName" autoComplete="organization" /></label>
          <label className="flex items-start gap-3 text-sm leading-relaxed text-black/60">
            <input className="mt-1 size-4" type="checkbox" name="consent" required />
            <span>I agree to the <Link href="/terms" className="text-[var(--color-accent)] hover:underline">Terms of Service</Link> and acknowledge the <Link href="/privacy" className="text-[var(--color-accent)] hover:underline">Privacy Policy</Link>.</span>
          </label>
          <Message state={onboardingState} />
          <button type="submit" disabled={onboardingPending} className="min-h-11 rounded-[4px] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white disabled:opacity-60">{onboardingPending ? "Saving…" : "Open workspace"}</button>
        </form>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div className="space-y-4">
        <AuthProgress step="otp" />
        <form action={verifyAction} className="flex flex-col gap-4" aria-busy={verifying}>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <p className="rounded-[4px] border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 p-4 text-sm text-black/65">Enter the six-digit code sent to <strong>{email}</strong>.</p>
          <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-black/55">One-time code<input className={inputClass} name="token" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" autoFocus /></label>
          <Message state={verifyState} />
          <button type="submit" disabled={verifying} className="min-h-11 rounded-[4px] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white disabled:opacity-60">{verifying ? "Verifying…" : "Verify OTP"}</button>
        </form>
        <form action={requestAction} className="flex flex-col gap-3">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <TurnstileWidget action="login" resetToken={requestState.resetToken} />
          <button type="submit" disabled={requesting || cooldown > 0} className="min-h-11 text-left text-sm text-[var(--color-accent)] hover:underline disabled:text-black/40">{cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}</button>
        </form>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <button type="button" onClick={() => setStep("email")} className="min-h-11 text-[var(--color-accent)] hover:underline">Change email</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AuthProgress step="email" />
      <form action={requestAction} className="flex flex-col gap-4" aria-busy={requesting}>
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-black/55">Email address<input className={inputClass} name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" autoFocus placeholder="name@company.com" /></label>
        <TurnstileWidget action="login" resetToken={requestState.resetToken} />
        <Message state={requestState} />
        <button type="submit" disabled={requesting} className="min-h-11 rounded-[4px] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white disabled:opacity-60">{requesting ? "Sending code…" : "Send access code"}</button>
      </form>
    </div>
  );
}
