"use client";

import { useActionState, useState } from "react";
import { finalizeStaffQuoteOfflinePaymentAction } from "@/app/staff/actions";
import { INITIAL_STAFF_ACTION_STATE } from "@/lib/staff/actionState";

type UploadSlot = { fileId: string; upload: { url: string; method: "PUT"; headers: Record<string, string> }; finalizeUrl: string };

export default function OfflinePaymentForm({ quoteId, quoteNumber }: { quoteId: string; quoteNumber: string }) {
  const [state, action, pending] = useActionState(finalizeStaffQuoteOfflinePaymentAction, INITIAL_STAFF_ACTION_STATE);
  const [proofFileId, setProofFileId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function uploadProof(file: File) {
    setUploading(true); setUploadError(""); setProofFileId("");
    try {
      const slotResponse = await fetch("/api/uploads/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffQuoteId: quoteId, kind: "proof", visibility: "staff_only", filename: file.name, contentType: file.type || "application/octet-stream", byteSize: file.size }) });
      const slot = await slotResponse.json() as UploadSlot & { error?: string };
      if (!slotResponse.ok) throw new Error(slot.error ?? "Payment-proof upload could not start");
      const put = await fetch(slot.upload.url, { method: slot.upload.method, headers: slot.upload.headers, body: file });
      if (!put.ok) throw new Error("Payment proof did not upload");
      const finalize = await fetch(slot.finalizeUrl, { method: "POST" });
      if (!finalize.ok) throw new Error("Payment proof could not be verified");
      setProofFileId(slot.fileId);
    } catch (error) { setUploadError(error instanceof Error ? error.message : "Payment-proof upload failed"); }
    finally { setUploading(false); }
  }

  return <form action={action} className="space-y-3 border-t border-black/10 pt-4">
    <input type="hidden" name="quoteId" value={quoteId} /><input type="hidden" name="quoteNumber" value={quoteNumber} /><input type="hidden" name="proofFileId" value={proofFileId} />
    <p className="text-xs font-semibold">Founder: record verified bank transfer</p>
    <label className="block text-xs">Payment reference<input name="reference" required minLength={3} className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm" /></label>
    <label className="block text-xs">Payment proof (PDF, PNG, JPG)<input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" required onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadProof(file); }} className="mt-1 block w-full text-xs" /></label>
    {proofFileId ? <p className="text-xs text-emerald-700">Payment proof uploaded and verified.</p> : null}{uploadError ? <p className="text-xs text-red-700">{uploadError}</p> : null}
    <button type="submit" disabled={pending || uploading || !proofFileId} className="w-full rounded border border-black/10 px-3 py-2 text-xs font-semibold disabled:opacity-50">{pending ? "Creating order…" : uploading ? "Uploading proof…" : "Record payment and create order"}</button>
    {state.status !== "idle" ? <p className={`text-xs ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p> : null}
  </form>;
}
