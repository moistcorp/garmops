"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type UploadSlot = {
  fileId: string;
  upload: { url: string; method: "PUT"; headers: Record<string, string> };
  finalizeUrl: string;
};

export default function CustomerArtworkReplacementForm({
  orderId,
  fileId,
  requirementLabel,
}: {
  orderId: string;
  fileId: string;
  requirementLabel: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) return;
    setPending(true);
    setMessage(null);
    try {
      const slotResponse = await fetch("/api/uploads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          replacementForFileId: fileId,
          kind: "customer_artwork",
          visibility: "customer",
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          byteSize: file.size,
        }),
      });
      const slotBody = await slotResponse.json().catch(() => ({})) as UploadSlot & { error?: string };
      if (!slotResponse.ok) throw new Error(slotBody.error || "Artwork replacement could not be started");
      const put = await fetch(slotBody.upload.url, {
        method: slotBody.upload.method,
        headers: slotBody.upload.headers,
        body: file,
      });
      if (!put.ok) throw new Error("Artwork upload did not complete");
      const finalized = await fetch(slotBody.finalizeUrl, { method: "POST" });
      if (!finalized.ok) throw new Error("Artwork upload could not be verified");
      setMessage("Replacement uploaded. The new revision is awaiting review.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Artwork replacement failed");
    } finally {
      setPending(false);
    }
  }

  return <form action={upload} className="mt-3 space-y-2 rounded border border-amber-200 bg-amber-50 p-3"><label className="block text-xs font-semibold text-amber-950">Replace {requirementLabel}<input name="file" type="file" required accept=".ai,.pdf,.svg,.png,.jpg,.jpeg" className="mt-2 block w-full text-xs" /></label><button type="submit" disabled={pending} className="rounded bg-amber-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{pending ? "Uploading…" : "Upload corrected artwork"}</button>{message ? <p role="status" className="text-xs text-amber-950">{message}</p> : null}</form>;
}
