"use client";
import { useActionState } from "react";
import { reviewArtworkAction } from "@/app/staff/actions";
import { INITIAL_STAFF_ACTION_STATE } from "@/lib/staff/actionState";
import type { Enums } from "@/types/database.generated";

export default function ArtworkReviewForm({
  fileId,
  orderId,
  scanStatus,
}: {
  fileId: string;
  orderId?: string;
  scanStatus: Enums<"file_scan_status">;
}) {
  const [state, action, pending] = useActionState(reviewArtworkAction, INITIAL_STAFF_ACTION_STATE);
  const canApprove = scanStatus === "clean" || scanStatus === "not_required";
  return <form action={action} className="grid gap-3 sm:grid-cols-[0.6fr_1fr_auto]"><input type="hidden" name="fileId" value={fileId} />{orderId ? <input type="hidden" name="orderId" value={orderId} /> : null}<select name="decision" defaultValue={canApprove ? "approve" : "reject"} required className="rounded border border-black/10 bg-white px-3 py-2 text-sm">{canApprove ? <option value="approve">Approve</option> : null}<option value="reject">Reject</option></select><input name="reason" placeholder="Reason required for rejection" className="rounded border border-black/10 px-3 py-2 text-sm" /><button disabled={pending} className="techpack-button" type="submit">{pending ? "Saving…" : "Save decision"}</button>{!canApprove ? <p className="text-xs text-amber-700 sm:col-span-3">Artwork cannot be approved until its malware scan is clean.</p> : null}{state.status !== "idle" ? <p className={`text-xs sm:col-span-3 ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p> : null}</form>;
}
