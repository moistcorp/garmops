"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Download, LoaderCircle } from "lucide-react";

interface ConfiguratorHeaderProps {
  configId: string;
  productName?: string;
  onDownloadPdf?: () => void;
  isDownloadingPdf?: boolean;
}

export function ConfiguratorHeader({
  productName = "Classic Tee",
  onDownloadPdf,
  isDownloadingPdf = false,
}: ConfiguratorHeaderProps) {
  return (
    <header className="relative mx-4 mb-3 mt-3 grid h-16 shrink-0 grid-cols-[1fr_auto] items-center rounded-full border border-[#ECE7DF] bg-white px-5 shadow-[0_4px_16px_rgba(22,33,43,0.04)]">
      <Link
        href="/"
        aria-label="Garmops home"
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      >
        <Image
          src="/logo3.png"
          alt="Garmops"
          width={908}
          height={114}
          className="h-9 w-auto object-contain"
        />
      </Link>

      <div className="flex items-center gap-2.5">
        <Link
          href="/configurator"
          aria-label="Back to product grid"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ECE7DF] bg-white transition-colors hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"
        >
          <ArrowLeft size={17} strokeWidth={2} />
        </Link>
        <span className="hidden rounded-full border border-[#ECE7DF] bg-white px-3 py-1.5 text-sm font-semibold text-[#111111]/70 sm:inline">
          {productName}
        </span>
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onDownloadPdf}
          disabled={!onDownloadPdf || isDownloadingPdf}
          className="flex items-center gap-2 rounded-full border border-[var(--color-teal)] px-3 py-2 text-sm font-semibold text-[var(--color-teal)] transition-colors hover:bg-[var(--color-teal)] hover:text-white disabled:cursor-not-allowed disabled:border-[#E5E5E5] disabled:text-[#111111]/35"
        >
          {isDownloadingPdf ? (
            <LoaderCircle size={16} strokeWidth={2.2} className="animate-spin" />
          ) : (
            <Download size={16} strokeWidth={2.2} />
          )}
          <span className="hidden sm:inline">
            {isDownloadingPdf ? "Creating PDF" : "Download design PDF"}
          </span>
          <span className="sm:hidden">PDF</span>
        </button>
      </div>
    </header>
  );
}
