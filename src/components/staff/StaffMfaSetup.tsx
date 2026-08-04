"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-[4px] border border-[var(--color-rule)] px-4 py-3 font-mono text-sm tracking-[0.18em] outline-none focus:border-[var(--color-accent)]";

type Enrolment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export default function StaffMfaSetup({ next = "/orders" }: { next?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("Checking your security settings…");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal.data?.currentLevel === "aal2") {
          await supabase.rpc("record_staff_mfa_enrollment");
          router.replace(next);
          return;
        }
        const factors = await supabase.auth.mfa.listFactors();
        const verified = factors.data?.totp.find((factor) => factor.status === "verified");
        if (verified) {
          if (!cancelled) {
            setVerifiedFactorId(verified.id);
            setStatus("Enter the current code from your authenticator app.");
          }
          return;
        }
        const created = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Garmops Foundry",
        });
        if (created.error || !created.data?.totp) {
          throw new Error(created.error?.message ?? "MFA enrolment could not be started");
        }
        if (!cancelled) {
          setEnrolment({
            factorId: created.data.id,
            qrCode: created.data.totp.qr_code,
            secret: created.data.totp.secret,
          });
          setStatus("Scan the QR code, then enter the six-digit code.");
        }
      } catch {
        if (!cancelled) setError("Security setup is temporarily unavailable.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [next, router, supabase]);

  async function verify() {
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the six-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const factorId = verifiedFactorId ?? enrolment?.factorId;
      if (!factorId) throw new Error("Missing MFA factor");
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error || !challenge.data) throw challenge.error;
      const verified = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      });
      if (verified.error) throw verified.error;
      await supabase.rpc("record_staff_mfa_enrollment");
      router.replace(next);
      router.refresh();
    } catch {
      setError("That code could not be verified. Check the time on your device and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-xl rounded-[4px] border border-[var(--color-rule)] bg-white p-6 sm:p-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-accent)]">
        Foundry security
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Authenticator verification</h1>
      <p className="mt-3 text-sm leading-relaxed text-black/55">{status}</p>

      {enrolment ? (
        <div className="mt-6 space-y-4">
          {/* Supabase returns a data URI. It never contains customer-provided markup. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrolment.qrCode}
            alt="QR code for Garmops Foundry authenticator setup"
            className="mx-auto size-56 border border-[var(--color-rule)] bg-white p-3"
          />
          <div className="rounded-[4px] bg-black/[0.035] p-4">
            <p className="text-xs uppercase tracking-wide text-black/45">Manual setup key</p>
            <code className="mt-2 block break-all text-sm">{enrolment.secret}</code>
          </div>
        </div>
      ) : null}

      {!busy || verifiedFactorId || enrolment ? (
        <div className="mt-6 space-y-3">
          <label className="block text-xs font-medium uppercase tracking-wide text-black/55">
            Six-digit code
            <input
              className={`${inputClass} mt-2`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
          </label>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void verify()}
            className="w-full rounded-[4px] bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify and open Foundry"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
