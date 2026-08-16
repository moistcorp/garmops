"use client";

import { useActionState } from "react";
import { startStaffMfaAction, verifyStaffMfaEnrollmentAction } from "@/app/(auth)/actions";
import { INITIAL_AUTH_ACTION_STATE } from "@/lib/auth/constants";

export default function StaffMfaSetup() {
  const [state, start, pending] = useActionState(startStaffMfaAction, INITIAL_AUTH_ACTION_STATE);
  const [verifyState, verify, verifying] = useActionState(verifyStaffMfaEnrollmentAction, INITIAL_AUTH_ACTION_STATE);
  const factorId = state.mfaFactorId;
  return <div className="w-full max-w-lg space-y-5"><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-black/45">Required security step</p><h1 className="mt-2 text-2xl font-semibold">Set up your authenticator</h1><p className="mt-2 text-sm text-black/55">Foundry access stays blocked until a TOTP authenticator is enrolled and verified.</p></div>{!factorId ? <form action={start}><button disabled={pending} className="techpack-button" type="submit">{pending ? "Preparing…" : "Start MFA enrollment"}</button></form> : <div className="space-y-4 rounded border border-black/10 bg-white p-5"><p className="text-sm">Add this account to an authenticator app. Manual secret:</p><code className="block break-all rounded bg-black/5 p-3 text-sm">{state.mfaSecret}</code>{state.mfaOtpAuthUrl ? <p className="break-all text-xs text-black/45">{state.mfaOtpAuthUrl}</p> : null}<form action={verify} className="flex gap-2"><input type="hidden" name="factorId" value={factorId}/><input name="code" inputMode="numeric" pattern="[0-9]{6}" required autoComplete="one-time-code" placeholder="6-digit code" className="techpack-control min-w-0 flex-1 rounded border px-3 py-2 text-sm"/><button disabled={verifying} className="techpack-button" type="submit">{verifying ? "Verifying…" : "Verify MFA"}</button></form></div>}{state.message ? <p className="text-sm text-black/60">{state.message}</p> : null}{verifyState.message ? <p className="text-sm text-red-700">{verifyState.message}</p> : null}</div>;
}
