"use client";
import { useActionState } from "react";
import { reviewArtworkAction } from "@/app/staff/actions";
import { INITIAL_STAFF_ACTION_STATE } from "@/lib/staff/actionState";
export default function ArtworkReviewForm({ fileId }: { fileId: string }) {
  const [state, action, pending] = useActionState(reviewArtworkAction, INITIAL_STAFF_ACTION_STATE);
  return <form action={action} className="grid gap-3 sm:grid-cols-[0.6fr_1fr_auto]"><input type="hidden" name="fileId" value={fileId} /><select name="decision" required className="rounded border border-black/10 bg-white px-3 py-2 text-sm"><option value="approved">Approve</option><option value="changes_requested">Request replacement</option><option value="rejected">Reject</option></select><input name="reason" placeholder="Reason required for changes/rejection" className="rounded border border-black/10 px-3 py-2 text-sm" /><button disabled={pending} className="techpack-button" type="submit">{pending ? "Saving…" : "Save decision"}</button>{state.status !== "idle" ? <p className={`text-xs sm:col-span-3 ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p> : null}</form>;
}
