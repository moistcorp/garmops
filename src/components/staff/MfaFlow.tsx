"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { completeStaffMfaAction } from "@/app/staff/actions";
import { createClient } from "@/lib/supabase/client";

type Enrollment = {
  id: string;
  qrCode: string;
  secret: string;
};

export default function MfaFlow({ mode }: { mode: "enrol" | "challenge" }) {
  const router = useRouter();
  const started = useRef(false);
  const [factorId, setFactorId] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("Preparing authenticator security…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const prepare = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        setMessage("Authenticator setup could not be loaded.");
        return;
      }
      const verified = data.totp.find((factor) => factor.status === "verified");
      if (mode === "challenge") {
        if (!verified) {
          router.replace("/staff/mfa/enrol");
          return;
        }
        setFactorId(verified.id);
        setMessage("Enter the six-digit code from your authenticator app.");
        return;
      }
      if (verified) {
        router.replace("/staff/mfa/challenge");
        return;
      }
      for (const factor of data.all.filter(
        (item) =>
          item.factor_type === "totp" && item.status === "unverified",
      )) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Garmops staff authenticator",
      });
      if (enrollError) {
        setMessage("Authenticator enrollment could not be started.");
        return;
      }
      setFactorId(enrolled.id);
      setEnrollment({
        id: enrolled.id,
        qrCode: enrolled.totp.qr_code,
        secret: enrolled.totp.secret,
      });
      setMessage("Scan the QR code, then enter the six-digit code.");
    };
    void prepare();
  }, [mode, router]);

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^[0-9]{6}$/.test(code) || !factorId || busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (error) {
      setMessage("That code was not accepted. Wait for a fresh code and try again.");
      setBusy(false);
      return;
    }
    const result = await completeStaffMfaAction();
    if (!result.ok) {
      setMessage("MFA succeeded, but staff access is not active.");
      setBusy(false);
      return;
    }
    router.replace("/staff");
    router.refresh();
  };

  return (
    <div className="liquid-glass-surface rounded-3xl border p-6 sm:p-8">
      {enrollment ? (
        <div className="mb-6 grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
          {/* Supabase returns a local data:image/svg+xml URL for this TOTP QR. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrollment.qrCode} alt="Authenticator enrollment QR code" className="h-[180px] w-[180px] rounded-xl bg-white p-2" />
          <div>
            <p className="text-sm text-black/55">Cannot scan it? Enter this secret manually:</p>
            <code className="mt-3 block break-all rounded-xl bg-black/5 p-3 text-xs">{enrollment.secret}</code>
            <p className="mt-3 text-xs text-black/40">Keep this secret private. Garmops will never ask for a code by email or phone.</p>
          </div>
        </div>
      ) : null}
      <p role="status" className="mb-5 text-sm text-black/55">{message}</p>
      <form onSubmit={verify} className="flex flex-col gap-3 sm:flex-row">
        <input
          className="liquid-glass-control min-w-0 flex-1 rounded-xl border px-4 py-3 text-center font-mono text-lg tracking-[0.3em] outline-none"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="Six-digit authenticator code"
          required
        />
        <button disabled={busy || !factorId || code.length !== 6} className="rounded-full bg-[var(--color-teal)] px-6 py-3 text-sm font-medium text-white disabled:opacity-50">
          {busy ? "Verifying…" : "Verify code"}
        </button>
      </form>
    </div>
  );
}
