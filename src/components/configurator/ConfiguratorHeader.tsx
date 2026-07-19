"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Link2 } from "lucide-react";

interface ConfiguratorHeaderProps {
  configId: string;
  productName?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConfiguratorHeader({
  configId,
  productName = "Classic Tee",
}: ConfiguratorHeaderProps) {
  // Local to this component — this is a share-link-copy counter, distinct
  // from any cart count shown elsewhere (per Appendix §3: "counter badge
  // separate from cart count"). Nothing else reads it, so it isn't lifted.
  const [shareCount, setShareCount] = useState(0);
  const [justCopied, setJustCopied] = useState(false);

  async function handleShareClick() {
    const url = `${window.location.origin}/configurator/build/${configId}`;

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API can fail (insecure context, permissions, unsupported
      // browser). The link itself is still valid — fail silently rather
      // than blocking the share-count/feedback UX on a copy failure.
    }

    setShareCount((prev) => prev + 1);
    setJustCopied(true);
    window.setTimeout(() => setJustCopied(false), 2000);
  }

  return (
    <header className="relative grid h-16 shrink-0 grid-cols-[1fr_auto] items-center px-5">
      <Link
        href="/"
        aria-label="Moist Foundry home"
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      >
        <img src="/logo3.png" alt="Moist Foundry" className="h-9 w-auto object-contain" />
      </Link>

      <div className="flex items-center gap-2.5">
        <Link
          href="/configurator"
          aria-label="Back to grid"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E1DED6] bg-white transition-colors hover:bg-[#F1EFE8]"
        >
          <ArrowLeft size={17} strokeWidth={2} />
        </Link>
        <span className="hidden rounded-md border border-[#E1DED6] bg-white px-3 py-1.5 text-sm font-semibold text-[#111111]/70 sm:inline">
          {productName}
        </span>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleShareClick}
          aria-label="Copy shareable link"
          className="relative flex items-center gap-2 rounded-md border border-transparent px-2.5 py-1.5 text-sm font-semibold transition-colors hover:border-[#E1DED6] hover:bg-white"
        >
          <Link2 size={16} strokeWidth={2.4} />
          {justCopied ? "Copied!" : "Share"}
          <span className="ml-1.5 flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E5E5] bg-[#F7F7F7] text-sm font-medium text-[#111111]/45">
            {shareCount}
          </span>
        </button>
      </div>
    </header>
  );
}
