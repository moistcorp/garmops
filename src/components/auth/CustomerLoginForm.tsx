"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction, verifyEmailOtpAction } from "@/app/(auth)/actions";
import {
  INITIAL_AUTH_ACTION_STATE,
  type AuthActionState,
} from "@/lib/auth/constants";
import TurnstileWidget from "@/components/auth/TurnstileWidget";

const inputClass = "techpack-control w-full rounded-[4px] border px-4 py-3 text-sm outline-none focus:!border-[var(--color-accent)]";

export default function CustomerLoginForm({ next }: { next: string }) {
  const [identifier, setIdentifier] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [codeMode, setCodeMode] = useState(false);
  const [phoneOtpPending, setPhoneOtpPending] = useState(false);
  const [requestState, requestCode, requesting] = useActionState(async (
    state: AuthActionState,
    formData: FormData,
  ) => {
    const result = await loginAction(state, formData);
    if (result.status === "success" && result.verificationEmail) {
      setCodeMode(true);
    }
    return result;
  }, INITIAL_AUTH_ACTION_STATE);
  const [verifyState, verifyCode, verifying] = useActionState(verifyEmailOtpAction, INITIAL_AUTH_ACTION_STATE);

  const normalizedIdentifier = identifier.trim();
  const currentEmail = requestState.verificationEmail ?? normalizedIdentifier;
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedIdentifier);
  const isPhone = /^\+?[1-9]\d{7,14}$/.test(normalizedIdentifier.replace(/[\s-]/g, ""));
  const hasIdentifier = normalizedIdentifier.length > 0;
  const hasValidIdentifier = isEmail || isPhone;
  const registerHref = isEmail
    ? `/register?email=${encodeURIComponent(normalizedIdentifier)}`
    : isPhone
      ? `/register?phone=${encodeURIComponent(normalizedIdentifier)}`
      : "/register";

  return codeMode ? (
    <form action={verifyCode} className="flex flex-col gap-4">
      <input type="hidden" name="email" value={currentEmail} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="portal" value="customer" />
      <p className="rounded-[4px] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900">Enter the 6-digit code sent to <strong>{currentEmail}</strong>.</p>
      <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-black/55">
        Email code
        <input className={inputClass} name="token" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" />
      </label>
      {verifyState.message ? <p role={verifyState.status === "error" ? "alert" : "status"} className={`rounded-[4px] border px-4 py-3 text-sm ${verifyState.status === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{verifyState.message}</p> : null}
      <button type="submit" disabled={verifying} className="rounded-[4px] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-white disabled:opacity-60">{verifying ? "Checking…" : "Continue with code"}</button>
      <button type="button" onClick={() => setCodeMode(false)} className="text-left text-xs text-[var(--color-accent)] hover:underline">Use a password instead</button>
    </form>
  ) : showPassword ? (
    <form action={requestCode} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="portal" value="customer" />
      <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-black/55">
        Email
        <input
          className={inputClass}
          name="email"
          type="email"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          required
          autoComplete="email"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-black/55">
        Password
        <input className={inputClass} name="password" type="password" required autoComplete="current-password" />
      </label>
      <TurnstileWidget action="login" resetToken={requestState.resetToken} />
      {requestState.message ? <p role={requestState.status === "error" ? "alert" : "status"} className={`rounded-[4px] border px-4 py-3 text-sm ${requestState.status === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{requestState.message}</p> : null}
      <button type="submit" disabled={requesting} className="rounded-[4px] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-white disabled:opacity-60">{requesting ? "Signing in…" : "Sign in with password"}</button>
      <Link href="/forgot-password" className="text-right text-xs text-[var(--color-accent)] hover:underline">Forgot password?</Link>
      <button type="button" onClick={() => setShowPassword(false)} className="text-left text-xs text-[var(--color-accent)] hover:underline">Use an email OTP instead</button>
    </form>
  ) : (
    <form
      action={requestCode}
      onSubmit={(event) => {
        if (!isPhone) return;
        event.preventDefault();
        setPhoneOtpPending(true);
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="portal" value="customer" />
      <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-black/55">
        Email or mobile number
        <input
          className={inputClass}
          name="email"
          type="text"
          value={identifier}
          onChange={(event) => {
            setIdentifier(event.target.value);
            setPhoneOtpPending(false);
          }}
          required
          autoComplete="username"
          inputMode={isPhone ? "tel" : "email"}
          placeholder="name@company.com or +91 98765 43210"
        />
      </label>
      {hasIdentifier && !hasValidIdentifier ? <p className="-mt-2 text-xs leading-relaxed text-black/45">Enter a valid email address or mobile number.</p> : null}
      {hasIdentifier ? (
        <>
          <TurnstileWidget action="login" resetToken={requestState.resetToken} />
          {requestState.message ? <p role={requestState.status === "error" ? "alert" : "status"} className={`rounded-[4px] border px-4 py-3 text-sm ${requestState.status === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{requestState.message}</p> : null}
          {phoneOtpPending ? <p role="status" className="rounded-[4px] border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 px-4 py-3 text-sm text-black/65">Phone OTP is being prepared and will be available soon. <Link href={registerHref} className="font-medium text-[var(--color-accent)] underline">Create an account</Link> with this mobile number in the meantime.</p> : null}
          <button type="submit" disabled={requesting || !hasValidIdentifier} className="rounded-[4px] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">{requesting ? "Requesting…" : isPhone ? "Continue with mobile" : "Continue"}</button>
        </>
      ) : null}
      <button type="button" onClick={() => setShowPassword(true)} className="text-left text-sm text-[var(--color-accent)] hover:underline">Login with password</button>
      <p className="text-xs leading-relaxed text-black/45">New to Garmops? <Link href={registerHref} className="text-[var(--color-accent)] hover:underline">Create your account</Link>.</p>
    </form>
  );
}
