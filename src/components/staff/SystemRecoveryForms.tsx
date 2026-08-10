"use client";

import { useActionState } from "react";
import {
  processIntegrationJobsNowAction,
  recheckCheckoutPaymentAction,
  retryIntegrationJobAction,
} from "@/app/staff/actions";
import { INITIAL_STAFF_ACTION_STATE } from "@/lib/staff/actionState";

function Result({ state }: { state: typeof INITIAL_STAFF_ACTION_STATE }) {
  if (state.status === "idle") return null;
  return <p role="status" className={`mt-2 text-xs ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p>;
}
export function RecheckPaymentForm({ attemptId }: { attemptId: string }) {
  const [state, action, pending] = useActionState(recheckCheckoutPaymentAction, INITIAL_STAFF_ACTION_STATE);
  return <form action={action}><input type="hidden" name="attemptId" value={attemptId} /><button disabled={pending} className="rounded border border-black/10 px-3 py-2 text-xs font-semibold" type="submit">{pending ? "Checking PayU…" : "Recheck PayU"}</button><Result state={state} /></form>;
}

export function RetryIntegrationJobForm({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState(retryIntegrationJobAction, INITIAL_STAFF_ACTION_STATE);
  return <form action={action}><input type="hidden" name="jobId" value={jobId} /><button disabled={pending} className="rounded border border-black/10 px-3 py-2 text-xs font-semibold" type="submit">{pending ? "Queuing…" : "Retry job"}</button><Result state={state} /></form>;
}

export function ProcessJobsNowForm() {
  const [state, action, pending] = useActionState(processIntegrationJobsNowAction, INITIAL_STAFF_ACTION_STATE);
  return <form action={action}><button disabled={pending} className="techpack-button" type="submit">{pending ? "Processing…" : "Process queued jobs now"}</button><Result state={state} /></form>;
}
