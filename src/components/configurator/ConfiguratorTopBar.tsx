"use client";

import {
  ConfiguratorJourney,
  type ConfiguratorJourneyStep,
} from "./ConfiguratorJourney";
import { NetworkStatusBanner } from "./NetworkStatusBanner";
import type { ProductId } from "@/lib/configurator/pricing";

export interface ConfiguratorTopBarProps {
  currentStep: ConfiguratorJourneyStep;
  backHref: string;
  onDownloadPdf?: () => void;
  isDownloadingPdf?: boolean;
  isDownloadDisabled?: boolean;
  showCart?: boolean;
  links?: Partial<Record<ConfiguratorJourneyStep, string>>;
  onStepSelect?: Partial<Record<ConfiguratorJourneyStep, () => void>>;
  className?: string;
}

export function getCartJourneyLinks(
  cartId: string,
  firstProductId?: ProductId,
  firstItemId?: string
): Partial<Record<ConfiguratorJourneyStep, string>> {
  const encodedCartId = encodeURIComponent(cartId);
  const buildHref = firstProductId && firstItemId
    ? `/configurator/build/${encodeURIComponent(firstProductId)}?cartId=${encodedCartId}&itemId=${encodeURIComponent(firstItemId)}`
    : "/configurator";
  const buildStepHref = (step: "garment-colour" | "artwork" | "neck-label") =>
    firstProductId && firstItemId ? `${buildHref}&step=${step}` : buildHref;

  return {
    product: "/configurator",
    colour: buildStepHref("garment-colour"),
    artwork: buildStepHref("artwork"),
    "neck-label": buildStepHref("neck-label"),
    quantity: `/configurator/cart/${encodedCartId}/review`,
    company: `/configurator/cart/${encodedCartId}/shipping`,
  };
}

export function ConfiguratorTopBar({
  currentStep,
  backHref,
  onDownloadPdf,
  isDownloadingPdf = false,
  isDownloadDisabled = false,
  showCart = false,
  links = {},
  onStepSelect = {},
  className = "",
}: ConfiguratorTopBarProps) {
  return (
    <div
      className={`sticky top-0 z-30 ml-[calc(50%-50dvw)] w-[100dvw] shrink-0 bg-transparent px-4 py-2.5 sm:py-3 ${className}`}
    >
      <header className="overflow-hidden rounded-[22px] border border-white/70 bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-black/5 backdrop-blur-2xl backdrop-saturate-150">
        <NetworkStatusBanner />

        <div className="bg-gradient-to-b from-white/35 via-white/15 to-white/5">
          <ConfiguratorJourney
            currentStep={currentStep}
            compact
            backHref={backHref}
            links={links}
            onStepSelect={onStepSelect}
            onDownloadPdf={onDownloadPdf}
            isDownloadingPdf={isDownloadingPdf}
            isDownloadDisabled={isDownloadDisabled}
            showCart={showCart}
            className="!rounded-none !border-0 !bg-transparent !shadow-none"
          />
        </div>
      </header>
    </div>
  );
}
