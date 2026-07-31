"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export default function InvoiceDownloadButton({ fileId }: { fileId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(fileId)}/download-url`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const body = (await response.json()) as {
        download?: { url?: string };
        error?: string;
      };
      if (!response.ok || !body.download?.url) {
        throw new Error(body.error ?? "Invoice download is unavailable");
      }
      window.location.assign(body.download.url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Invoice download is unavailable");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-[4px] bg-[#1D49B4] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        <Download size={14} aria-hidden="true" />
        {busy ? "Preparing…" : "Download PDF"}
      </button>
      {error ? <p className="mt-2 max-w-xs text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
