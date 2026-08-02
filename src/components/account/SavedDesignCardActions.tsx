"use client";

import { Archive, Copy, MoreHorizontal, Pencil, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CloudDesignSnapshot } from "@/lib/designs/schema";
import { duplicateDesign } from "@/lib/designs/client";

export default function SavedDesignCardActions({
  designId,
  title,
  revision,
  status,
  snapshot,
}: {
  designId: string;
  title: string;
  revision: number;
  status: string;
  snapshot: CloudDesignSnapshot;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nextTitle, setNextTitle] = useState(title);
  const [message, setMessage] = useState<string | null>(null);

  async function rename() {
    const value = nextTitle.trim();
    if (!value || value === title) { setRenaming(false); return; }
    const response = await fetch(`/api/designs/${encodeURIComponent(designId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision: revision, schemaVersion: 1, snapshot, title: value }),
    });
    if (response.ok) { setRenaming(false); setOpen(false); router.refresh(); }
    else setMessage(response.status === 409 ? "This design changed. Refresh and try again." : "The name could not be changed.");
  }

  async function duplicate() {
    const result = await duplicateDesign(designId, `${title} copy`);
    if (result.ok) router.push(`/account/designs/${encodeURIComponent(result.designId)}`);
    else setMessage("The design could not be duplicated.");
  }

  async function archive() {
    if (!window.confirm("Archive this saved design?")) return;
    const response = await fetch(`/api/designs/${encodeURIComponent(designId)}`, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: revision }),
    });
    if (response.ok) router.refresh();
    else setMessage("The design could not be archived.");
  }

  return (
    <div className="relative">
      <button type="button" aria-label={`More actions for ${title}`} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex size-10 items-center justify-center rounded-[4px] border border-black/10 text-black/55 hover:border-[#1D49B4]/35 hover:text-[#1D49B4]">
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-20 w-48 rounded-[4px] border border-black/10 bg-white p-1.5 shadow-lg">
          <button type="button" onClick={() => setRenaming(true)} className="flex min-h-10 w-full items-center gap-2 rounded px-3 text-left text-sm hover:bg-black/5"><Pencil size={15} /> Rename</button>
          <button type="button" onClick={duplicate} className="flex min-h-10 w-full items-center gap-2 rounded px-3 text-left text-sm hover:bg-black/5"><Copy size={15} /> Duplicate</button>
          {status === "draft" ? <button type="button" onClick={archive} className="flex min-h-10 w-full items-center gap-2 rounded px-3 text-left text-sm text-red-700 hover:bg-red-50"><Archive size={15} /> Archive</button> : null}
        </div>
      ) : null}
      {renaming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#16212B]/35 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRenaming(false); }}>
          <div className="w-full max-w-md rounded-[4px] border border-black/10 bg-white p-6" role="dialog" aria-modal="true" aria-labelledby={`rename-${designId}`}>
            <div className="flex items-start justify-between gap-4"><h2 id={`rename-${designId}`} className="text-xl font-semibold">Rename saved design</h2><button type="button" aria-label="Close" onClick={() => setRenaming(false)}><X size={18} /></button></div>
            <label className="mt-5 block text-sm font-medium" htmlFor={`title-${designId}`}>Design name</label>
            <input id={`title-${designId}`} autoFocus value={nextTitle} onChange={(event) => setNextTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void rename(); }} maxLength={160} className="mt-2 w-full rounded border border-black/15 px-3 py-2.5 outline-none focus:border-[#1D49B4]" />
            {message ? <p role="alert" className="mt-2 text-sm text-red-700">{message}</p> : null}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setRenaming(false)} className="rounded border border-black/10 px-4 py-2 text-sm">Cancel</button><button type="button" onClick={() => void rename()} className="rounded bg-[#1D49B4] px-4 py-2 text-sm font-semibold text-white">Save name</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
