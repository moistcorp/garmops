"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Download, LoaderCircle } from "lucide-react";
import {
  ConfiguratorJourney,
  type ConfiguratorJourneyStep,
} from "./ConfiguratorJourney";
import { NetworkStatusBanner } from "./NetworkStatusBanner";
import ProductPickerCartLink from "./products/ProductPickerCartLink";
import type { ProductId } from "@/lib/configurator/pricing";

export interface ConfiguratorTopBarProps {
  currentStep: ConfiguratorJourneyStep;
  backHref: string;
  title?: string;
  onDownloadPdf?: () => void;
  isDownloadingPdf?: boolean;
  isDownloadDisabled?: boolean;
  showCart?: boolean;
  links?: Partial<Record<ConfiguratorJourneyStep, string>>;
  className?: string;
}

export function getCartJourneyLinks(
  cartId: string,
  firstProductId?: ProductId,
  firstItemId?: string
): Partial<Record<ConfiguratorJourneyStep, string>> {
  const encodedCartId = encodeURIComponent(cartId);
  const customiseHref = firstProductId && firstItemId
    ? `/configurator/build/${encodeURIComponent(firstProductId)}?cartId=${encodedCartId}&itemId=${encodeURIComponent(firstItemId)}`
    : "/configurator";

  return {
    product: "/configurator",
    customise: customiseHref,
    quantity: `/configurator/cart/${encodedCartId}/review`,
    company: `/configurator/cart/${encodedCartId}/shipping`,
  };
}

export function ConfiguratorTopBar({
  currentStep,
  backHref,
  title,
  onDownloadPdf,
  isDownloadingPdf = false,
  isDownloadDisabled = false,
  showCart = false,
  links = {},
  className = "",
}: ConfiguratorTopBarProps) {
  return (
    <div
      className={`sticky top-0 z-30 shrink-0 bg-white/95 py-3 backdrop-blur-md ${className}`}
    >
      <header className="overflow-hidden rounded-2xl border border-[#ECE7DF] bg-white shadow-[0_4px_16px_rgba(22,33,43,0.04)]">
        <NetworkStatusBanner />

        <div className="flex min-h-12 items-center justify-between gap-3 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href={backHref}
              aria-label="Go back"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ECE7DF] bg-white transition-colors hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"
            >
              <ArrowLeft size={17} strokeWidth={2} />
            </Link>

            <Link
              href="/"
              aria-label="Garmops home"
              className="flex shrink-0 items-center"
            >
              <Image
                src="/logo3.png"
                alt="Garmops"
                width={908}
                height={114}
                className="block h-5 w-auto object-contain"
                preload
              />
            </Link>

            {title && (
              <span className="hidden truncate text-sm font-semibold text-[#111111]/70 sm:block">
                {title}
              </span>
            )}
          </div>

          {(onDownloadPdf || showCart) && (
            <div className="flex shrink-0 items-center gap-2">
              {onDownloadPdf && (
                <button
                  type="button"
                  onClick={onDownloadPdf}
                  disabled={isDownloadDisabled || isDownloadingPdf}
                  className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-[var(--color-teal)] px-3 text-sm font-semibold text-[var(--color-teal)] transition-colors hover:bg-[var(--color-teal)] hover:text-white disabled:cursor-not-allowed disabled:border-[#E5E5E5] disabled:text-[#111111]/35"
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
              )}
              {showCart && <ProductPickerCartLink />}
            </div>
          )}
        </div>

        <div className="border-t border-[#ECE7DF]">
          <ConfiguratorJourney
            currentStep={currentStep}
            compact
            links={links}
            className="!rounded-none !border-0 !bg-transparent !shadow-none"
          />
        </div>
      </header>
    </div>
  );
}
