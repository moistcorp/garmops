"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, Link2 } from "lucide-react";
import type { Artwork, NeckLabel } from "@/lib/configurator/types/configurator";

interface ConfiguratorHeaderProps {
  configId: string;
  productName?: string;
  designPayload?: unknown;
}

type SharePayload = Record<string, unknown> & {
  artwork?: Artwork;
  neckLabel?: Partial<NeckLabel>;
};

function isBrowserOnlyUpload(fileUrl?: string, fileKey?: string): boolean {
  return Boolean(fileKey || fileUrl?.startsWith("blob:"));
}

function prepareSharePayload(payload: unknown): {
  payload: unknown;
  omittedUploads: number;
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { payload, omittedUploads: 0 };
  }

  const source = payload as SharePayload;
  const next: SharePayload = { ...source };
  let omittedUploads = 0;

  if (source.artwork) {
    const artwork: Artwork = { ...source.artwork };
    if (artwork.front && isBrowserOnlyUpload(artwork.front.fileUrl, artwork.front.fileKey)) {
      artwork.front = undefined;
      omittedUploads += 1;
    }
    if (artwork.back && isBrowserOnlyUpload(artwork.back.fileUrl, artwork.back.fileKey)) {
      artwork.back = undefined;
      omittedUploads += 1;
    }
    next.artwork = artwork;
  }

  if (
    source.neckLabel &&
    isBrowserOnlyUpload(source.neckLabel.fileUrl, source.neckLabel.fileKey)
  ) {
    next.neckLabel = {};
    omittedUploads += 1;
  }

  return { payload: next, omittedUploads };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConfiguratorHeader({
  configId,
  productName = "Classic Tee",
  designPayload,
}: ConfiguratorHeaderProps) {
  // Local to this component — this is a share-link-copy counter, distinct
  // from any cart count shown elsewhere (per Appendix §3: "counter badge
  // separate from cart count"). Nothing else reads it, so it isn't lifted.
  const [shareCount, setShareCount] = useState(0);
  const [justCopied, setJustCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [shareNotice, setShareNotice] = useState("");

  async function handleShareClick() {
    const baseUrl = `${window.location.origin}/configurator/build/${encodeURIComponent(configId)}`;
    let url = baseUrl;
    let omittedUploads = 0;
    if (designPayload) {
      const prepared = prepareSharePayload(designPayload);
      omittedUploads = prepared.omittedUploads;
      const json = JSON.stringify(prepared.payload);
      const encoded = btoa(
        Array.from(new TextEncoder().encode(json), (byte) =>
          String.fromCharCode(byte)
        ).join("")
      );
      url = `${baseUrl}?design=${encodeURIComponent(encoded)}`;
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareCount((prev) => prev + 1);
      setJustCopied(true);
      setCopyFailed(false);
      setShareNotice(
        omittedUploads > 0
          ? `Link copied without ${omittedUploads} uploaded file${omittedUploads === 1 ? "" : "s"}. Uploads stay on this browser until cloud storage is added.`
          : "Share link copied."
      );
      window.setTimeout(() => {
        setJustCopied(false);
        setShareNotice("");
      }, 4500);
    } catch {
      setCopyFailed(true);
      setJustCopied(false);
      setShareNotice("Could not copy the share link.");
      window.setTimeout(() => {
        setCopyFailed(false);
        setShareNotice("");
      }, 2000);
    }
  }

  return (
    <header className="relative grid h-16 shrink-0 grid-cols-[1fr_auto] items-center px-5">
      <Link
        href="/"
        aria-label="Garmops home"
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      >
        <Image src="/logo3.png" alt="Garmops" width={908} height={114} className="h-9 w-auto object-contain" />
      </Link>

      <div className="flex items-center gap-2.5">
        <Link
          href="/configurator"
          aria-label="Back to grid"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ECE7DF] bg-white transition-colors hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"
        >
          <ArrowLeft size={17} strokeWidth={2} />
        </Link>
        <span className="hidden rounded-full border border-[#ECE7DF] bg-white px-3 py-1.5 text-sm font-semibold text-[#111111]/70 sm:inline">
          {productName}
        </span>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleShareClick}
          aria-label="Copy shareable link"
          className="relative flex items-center gap-2 rounded-full border border-transparent px-2.5 py-1.5 text-sm font-semibold transition-colors hover:border-[var(--color-teal)] hover:bg-white hover:text-[var(--color-teal)]"
        >
          <Link2 size={16} strokeWidth={2.4} />
          {copyFailed ? "Copy failed" : justCopied ? "Copied!" : "Share"}
          <span className="ml-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-[#ECE7DF] bg-[var(--color-cream-soft)] text-sm font-medium text-[#111111]/45">
            {shareCount}
          </span>
        </button>
      </div>
      {shareNotice && (
        <p
          role="status"
          aria-live="polite"
          className="absolute right-5 top-[calc(100%-2px)] z-50 max-w-sm rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-xs leading-relaxed text-[#111111]/70 shadow-lg"
        >
          {shareNotice}
        </p>
      )}
    </header>
  );
}
