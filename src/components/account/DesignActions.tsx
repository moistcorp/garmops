"use client";

import { Archive, Copy, ExternalLink, LoaderCircle, Pencil, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { duplicateDesign } from "@/lib/designs/client";
import type { CloudDesignSnapshot } from "@/lib/designs/schema";

export default function DesignActions({
  designId,
  title,
  initialRevision,
  status,
  snapshot,
}: {
  designId: string;
  title: string;
  initialRevision: number;
  status: string;
  snapshot: CloudDesignSnapshot;
}) {
  const router = useRouter();
  const [revision, setRevision] = useState(initialRevision);
  const [pending, setPending] = useState<"duplicate" | "archive" | "rename" | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nextTitle, setNextTitle] = useState(title);
  const [message, setMessage] = useState<string | null>(null);
  const editable = status === "draft";
  const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-[4px] border border-black/10 px-3.5 py-2 text-sm font-semibold text-black/70 transition hover:border-[#1D49B4]/35 hover:text-[#1D49B4] disabled:cursor-not-allowed disabled:opacity-50";

  async function rename() {
    if (!nextTitle.trim() || nextTitle.trim() === title) { setRenaming(false); return; }
    setPending("rename");
    const response = await fetch(`/api/designs/${encodeURIComponent(designId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision: revision, schemaVersion: 1, snapshot, title: nextTitle.trim() }),
    });
    if (response.ok) {
      const body = await response.json() as { design?: { draftRevision?: number } };
      setRevision(body.design?.draftRevision ?? revision);
      setRenaming(false);
      router.refresh();
    } else setMessage(response.status === 409 ? "This design changed. Refresh and try again." : "The name could not be changed.");
    setPending(null);
  }

  async function duplicate() {
    setPending("duplicate");
    const result = await duplicateDesign(designId, `${title} copy`);
    if (result.ok) router.push(`/account/designs/${encodeURIComponent(result.designId)}`);
    else setMessage("The design could not be duplicated.");
    setPending(null);
  }

  async function archive() {
    if (!window.confirm("Archive this saved design?")) return;
    setPending("archive");
    const response = await fetch(`/api/designs/${encodeURIComponent(designId)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision: revision }),
    });
    if (response.ok) router.push("/account/designs");
    else setMessage(response.status === 409 ? "This design changed. Refresh and try again." : "The design could not be archived.");
    setPending(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => router.push(`/configurator/build/${encodeURIComponent(snapshot.configId)}?designId=${encodeURIComponent(designId)}`)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[4px] bg-[#1D49B4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#173A91]"><ExternalLink size={16} /> Continue editing</button>
        <button type="button" onClick={() => setRenaming(true)} disabled={pending !== null} className={button}><Pencil size={16} /> Rename</button>
        <button type="button" onClick={() => void duplicate()} disabled={pending !== null} className={button}>{pending === "duplicate" ? <LoaderCircle size={16} className="animate-spin" /> : <Copy size={16} />} Duplicate</button>
        {editable ? <button type="button" onClick={() => void archive()} disabled={pending !== null} className={button}>{pending === "archive" ? <LoaderCircle size={16} className="animate-spin" /> : <Archive size={16} />} Archive</button> : null}
      </div>
      {message ? <p role="alert" className="text-sm text-red-700">{message}</p> : null}
      {renaming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#16212B]/35 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRenaming(false); }}>
          <div className="w-full max-w-md rounded-[4px] border border-black/10 bg-white p-6" role="dialog" aria-modal="true" aria-labelledby="rename-design-title">
            <div className="flex items-start justify-between gap-4"><h2 id="rename-design-title" className="text-xl font-semibold">Rename saved design</h2><button type="button" aria-label="Close" onClick={() => setRenaming(false)}><X size={18} /></button></div>
            <label className="mt-5 block text-sm font-medium" htmlFor="saved-design-title">Design name</label>
            <input id="saved-design-title" autoFocus value={nextTitle} onChange={(event) => setNextTitle(event.target.value)} maxLength={160} className="mt-2 w-full rounded border border-black/15 px-3 py-2.5 outline-none focus:border-[#1D49B4]" />
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setRenaming(false)} className="rounded border border-black/10 px-4 py-2 text-sm">Cancel</button><button type="button" onClick={() => void rename()} disabled={pending !== null} className="rounded bg-[#1D49B4] px-4 py-2 text-sm font-semibold text-white">Save name</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
