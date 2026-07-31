"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export default function PrivateFileDownloadButton({
  fileId,
  label = "Download",
}: {
  fileId: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/files/${encodeURIComponent(fileId)}/download-url`,
        { method: "POST", headers: { "content-type": "application/json" } },
      );
      const body = (await response.json()) as {
        download?: { url?: string };
        error?: string;
      };
      if (!response.ok || !body.download?.url) {
        throw new Error(body.error ?? "Download is unavailable");
      }
      window.location.assign(body.download.url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Download is unavailable",
      );
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-[4px] border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black/65 disabled:opacity-50"
      >
        <Download size={13} aria-hidden="true" />
        {busy ? "Preparing…" : label}
      </button>
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
