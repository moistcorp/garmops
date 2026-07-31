"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Kind = "approval_pdf" | "qc_photo" | "packing_list" | "shipping_label" | "shipment_document";

const labels: Record<Kind, string> = {
  approval_pdf: "Approval PDF",
  qc_photo: "QC evidence",
  packing_list: "Packing list",
  shipping_label: "Shipping label",
  shipment_document: "Shipment document",
};

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function contentTypeFor(file: File) {
  if (file.type) return file.type.toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  return "application/octet-stream";
}

export default function StaffEvidenceUploader({
  orderId,
  kind,
  visibility = "staff_only",
}: {
  orderId: string;
  kind: Kind;
  visibility?: "customer" | "staff_only";
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function upload() {
    const file = input.current?.files?.[0];
    if (!file) return;
    setState("uploading");
    setMessage("Preparing secure upload…");
    try {
      const checksum = await sha256(file);
      const contentType = contentTypeFor(file);
      const slotResponse = await fetch("/api/uploads/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, kind, visibility, filename: file.name, contentType, byteSize: file.size, sha256: checksum }),
      });
      const slot = await slotResponse.json();
      if (!slotResponse.ok) throw new Error(slot.error ?? "Upload slot could not be created");
      const putResponse = await fetch(slot.upload.url, { method: slot.upload.method, headers: slot.upload.headers, body: file });
      if (!putResponse.ok) throw new Error("The file could not be transferred to private storage");
      const finalizeResponse = await fetch(slot.finalizeUrl, { method: "POST" });
      const finalized = await finalizeResponse.json();
      if (!finalizeResponse.ok) throw new Error(finalized.error ?? "Upload could not be finalized");
      setState("done");
      setMessage(`${labels[kind]} uploaded. A permitted reviewer must clear it before use.`);
      if (input.current) input.current.value = "";
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Upload failed");
    }
  }

  const accept = kind === "approval_pdf" ? "application/pdf,.pdf" : kind === "qc_photo" ? "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" : "application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg";

  return (
    <div className="rounded-[4px] border border-dashed border-black/15 bg-white p-4">
      <label className="block text-xs font-semibold text-black/60">Upload {labels[kind]}</label>
      <input ref={input} type="file" accept={accept} className="mt-3 block w-full text-xs" />
      <button type="button" onClick={upload} disabled={state === "uploading"} className="mt-3 rounded-[4px] bg-[#16212B] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
        {state === "uploading" ? "Uploading…" : "Upload securely"}
      </button>
      {message ? <p className={`mt-2 text-xs ${state === "error" ? "text-red-700" : "text-black/50"}`} role="status">{message}</p> : null}
    </div>
  );
}
