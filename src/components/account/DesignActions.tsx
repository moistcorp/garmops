"use client";

import { Copy, ExternalLink, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { duplicateDesign } from "@/lib/designs/client";
import type { CloudDesignSnapshot } from "@/lib/designs/schema";

export default function DesignActions({
  designId,
  title,
  snapshot,
}: {
  designId: string;
  title: string;
  snapshot: CloudDesignSnapshot;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"duplicate" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-sm border border-black/10 px-3.5 py-2 text-sm font-semibold text-black/70 transition hover:border-(--color-accent)/35 hover:text-(--color-accent) disabled:cursor-not-allowed disabled:opacity-50";

  async function duplicate() {
    setPending("duplicate");
    const result = await duplicateDesign(designId, `${title} copy`);
    if (result.ok) router.push(`/account/designs/${encodeURIComponent(result.designId)}`);
    else setMessage("The design could not be duplicated.");
    setPending(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => router.push(`/configurator/build/${encodeURIComponent(snapshot.configId)}?designId=${encodeURIComponent(designId)}`)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-sm bg-(--color-accent) px-4 py-2 text-sm font-semibold text-white hover:bg-(--color-accent-dark)"><ExternalLink size={16} /> Continue editing</button>
        <button type="button" onClick={() => void duplicate()} disabled={pending !== null} className={button}>{pending === "duplicate" ? <LoaderCircle size={16} className="animate-spin" /> : <Copy size={16} />} Duplicate</button>
      </div>
      {message ? <p role="alert" className="text-sm text-red-700">{message}</p> : null}
    </div>
  );
}
