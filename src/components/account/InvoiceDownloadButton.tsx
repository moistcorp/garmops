"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export default function InvoiceDownloadButton({ fileId, invoiceId }: { fileId?: string; invoiceId?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const path = invoiceId
        ? `/api/medusa/store/garmops/invoices/${encodeURIComponent(invoiceId)}`
        : `/api/files/${encodeURIComponent(fileId ?? "")}/download-url`;
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const body = (await response.json()) as {
        download?: { url?: string };
        url?: string;
        error?: string;
      };
      const url = body.download?.url ?? body.url;
      if (!response.ok || !url) {
        throw new Error(body.error ?? "Invoice download is unavailable");
      }
      window.location.assign(url);
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
        className="inline-flex items-center gap-2 rounded-sm bg-(--color-accent) px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        <Download size={14} aria-hidden="true" />
        {busy ? "Preparing…" : "Download PDF"}
      </button>
      {error ? <p className="mt-2 max-w-xs text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
