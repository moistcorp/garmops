"use client";

import type { ReactNode } from "react";
import {
  ConfiguratorJourney,
  type ConfiguratorJourneyStep,
} from "./ConfiguratorJourney";
import { NetworkStatusBanner } from "./NetworkStatusBanner";
import type { ProductId } from "@/lib/configurator/pricing";

export interface ConfiguratorTopBarProps {
  currentStep: ConfiguratorJourneyStep;
  backHref?: string;
  onDownloadPdf?: () => void;
  isDownloadingPdf?: boolean;
  isDownloadDisabled?: boolean;
  showCart?: boolean;
  productName?: string;
  specReference?: string;
  accountSaveNotice?: ReactNode;
  links?: Partial<Record<ConfiguratorJourneyStep, string>>;
  onStepSelect?: Partial<Record<ConfiguratorJourneyStep, () => void>>;
  className?: string;
}

export function getCartProductLabel(
  items: readonly { productName: string }[]
): string | undefined {
  const firstProductName = items[0]?.productName.trim();
  if (!firstProductName) return undefined;
  return items.length > 1
    ? `${firstProductName} + ${items.length - 1} more`
    : firstProductName;
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
    delivery: `/configurator/cart/${encodedCartId}/shipping`,
  };
}

export function ConfiguratorTopBar({
  currentStep,
  backHref,
  onDownloadPdf,
  isDownloadingPdf = false,
  isDownloadDisabled = false,
  showCart = false,
  productName,
  specReference,
  accountSaveNotice,
  links = {},
  onStepSelect = {},
  className = "",
}: ConfiguratorTopBarProps) {
  return (
    <div
      className={`sticky top-0 z-40 ml-[calc(50%-50dvw)] w-dvw shrink-0 bg-(--color-studio-bg) px-4 py-3 sm:py-4 ${className}`}
    >
      <header className="overflow-hidden rounded-md border border-(--color-control-border) bg-white">
        <NetworkStatusBanner />

        <div>
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
            productName={productName}
            specReference={specReference}
            accountSaveNotice={accountSaveNotice}
            className="rounded-none! border-0! bg-transparent!"
          />
        </div>
      </header>
    </div>
  );
}