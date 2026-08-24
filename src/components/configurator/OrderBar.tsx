"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import type { PricingBreakdown } from "@/lib/configurator/pricing";
import { formatInr } from "@/lib/configurator/pricing";
import {
  VOLUME_DISCOUNT_TIERS,
  type VolumeDiscountTier,
} from "@/lib/pricingRules";

export interface OrderBarProps {
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  minQuantity?: number;
  ctaLabel: string;
  onCtaClick?: () => void;
  pricingBreakdown: PricingBreakdown;
  ctaErrorMessage?: string | null;
  ctaErrorNonce?: number;
  compactEstimate?: boolean;
  ctaDisabled?: boolean;
}

export interface VolumeDiscountProgressState {
  currentDiscountPercent: number;
  nextDiscountPercent: number | null;
  unitsToNextTier: number;
  progress: number;
  progressMin: number;
  progressMax: number | null;
  isHighestTier: boolean;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function getVolumeDiscountProgress(
  quantity: number,
  tiers: VolumeDiscountTier[] = VOLUME_DISCOUNT_TIERS
): VolumeDiscountProgressState {
  const safeQuantity = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  const validTiers = tiers
    .filter(
      (tier) =>
        Number.isFinite(tier.minQty) &&
        tier.minQty >= 0 &&
        Number.isFinite(tier.discountPercent) &&
        tier.discountPercent >= 0
    )
    .sort((a, b) => a.minQty - b.minQty);

  const currentTier = [...validTiers]
    .reverse()
    .find(
      (tier) =>
        safeQuantity >= tier.minQty &&
        (tier.maxQty === null ||
          (Number.isFinite(tier.maxQty) && safeQuantity <= tier.maxQty))
    );
  const currentDiscountPercent = currentTier?.discountPercent ?? 0;
  const nextTier = validTiers.find(
    (tier) =>
      tier.minQty > safeQuantity && tier.discountPercent > currentDiscountPercent
  );
  const progressMin = currentTier?.minQty ?? 0;

  if (!nextTier) {
    return {
      currentDiscountPercent,
      nextDiscountPercent: null,
      unitsToNextTier: 0,
      progress: currentDiscountPercent > 0 ? 1 : 0,
      progressMin,
      progressMax: null,
      isHighestTier: currentDiscountPercent > 0,
    };
  }

  const progressRange = nextTier.minQty - progressMin;
  const progress =
    progressRange > 0
      ? clamp((safeQuantity - progressMin) / progressRange, 0, 1)
      : 0;

  return {
    currentDiscountPercent,
    nextDiscountPercent: nextTier.discountPercent,
    unitsToNextTier: Math.max(0, nextTier.minQty - safeQuantity),
    progress,
    progressMin,
    progressMax: nextTier.minQty,
    isHighestTier: false,
  };
}

export function getVolumeDiscountMessage(quantity: number): string {
  const state = getVolumeDiscountProgress(quantity);
  const hasNextTier = state.nextDiscountPercent !== null && state.progressMax !== null;
  return state.isHighestTier
    ? `${state.currentDiscountPercent}% volume discount applied · Highest discount tier`
    : hasNextTier && state.currentDiscountPercent > 0
      ? `${state.currentDiscountPercent}% volume discount applied · ${state.unitsToNextTier} more unit${state.unitsToNextTier === 1 ? "" : "s"} to unlock ${state.nextDiscountPercent}%`
      : hasNextTier
        ? `${state.unitsToNextTier <= 20 ? "Only " : "Add "}${state.unitsToNextTier} more unit${state.unitsToNextTier === 1 ? "" : "s"} to unlock ${state.nextDiscountPercent}% off`
        : "Volume pricing updates automatically in the Sizes & quantity step";
}

function VolumeDiscountProgress({ quantity }: { quantity: number }) {
  const state = getVolumeDiscountProgress(quantity);
  const hasNextTier = state.nextDiscountPercent !== null && state.progressMax !== null;
  const message = getVolumeDiscountMessage(quantity);

  return (
    <div className="px-1">
      <div className="flex items-start gap-2 text-xs font-semibold leading-4 text-(--color-accent)">
        <TrendingUp size={14} strokeWidth={2.4} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </div>
      {hasNextTier && (
        <div
          role="progressbar"
          aria-label={`Progress toward ${state.nextDiscountPercent}% volume discount`}
          aria-valuemin={state.progressMin}
          aria-valuemax={state.progressMax ?? undefined}
          aria-valuenow={Math.min(quantity, state.progressMax ?? quantity)}
          className="mt-1 h-1 overflow-hidden rounded-sm bg-[#DCE8E4]"
        >
          <div
            className="h-full rounded-sm bg-(--color-accent) transition-[width] duration-200"
            style={{ width: `${Math.round(state.progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function OrderBar({
  quantity,
  onQuantityChange,
  minQuantity = 50,
  ctaLabel,
  onCtaClick,
  pricingBreakdown,
  ctaErrorMessage,
  ctaErrorNonce,
  compactEstimate = false,
  ctaDisabled = false,
}: OrderBarProps) {
  const discountedUnitCost =
    pricingBreakdown.unitPrice * (1 - pricingBreakdown.discountPercent / 100);
  const [flashError, setFlashError] = useState(false);
  const [quantityDraft, setQuantityDraft] = useState(String(quantity));
  const [lastSyncedQuantity, setLastSyncedQuantity] = useState(quantity);

  if (quantity !== lastSyncedQuantity) {
    setLastSyncedQuantity(quantity);
    setQuantityDraft(String(quantity));
  }

  function commitQuantityDraft(raw: string) {
    const trimmed = raw.trim();
    const parsed = Number(trimmed);
    const next =
      trimmed !== "" && Number.isFinite(parsed)
        ? Math.floor(parsed)
        : minQuantity;
    const safeNext = Math.max(minQuantity, next);
    setQuantityDraft(String(safeNext));
    setLastSyncedQuantity(safeNext);
    onQuantityChange(safeNext);
  }

  useEffect(() => {
    if (!ctaErrorNonce) return;
    const showTimer = setTimeout(() => setFlashError(true), 0);
    const hideTimer = setTimeout(() => setFlashError(false), 1600);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [ctaErrorNonce]);

  const quantityPresets = [...new Set([minQuantity, 50, 100, 250, 500])]
    .filter((preset) => preset >= minQuantity)
    .sort((left, right) => left - right);

  return (
    <section
      aria-label="Order estimate"
      className="techpack-surface rounded-md !border-(--color-control-border) !bg-white border p-2"
    >
      {compactEstimate ? (
        <div className="grid grid-cols-3 divide-x divide-(--color-control-border) rounded-sm border border-(--color-control-border)/70 bg-(--color-cream-soft)/45 py-2">
          <div className="min-w-0 px-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-(--text-primary)/45">Quantity</p>
            <p className="mt-0.5 truncate font-mono text-sm font-semibold text-(--text-primary)">{quantity} pcs</p>
          </div>
          <div className="min-w-0 px-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-(--text-primary)/45">Unit cost</p>
            <p className="mt-0.5 truncate font-mono text-sm font-semibold text-(--text-primary)">{formatInr(discountedUnitCost)}</p>
          </div>
          <div className="min-w-0 px-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-(--text-primary)/45">Estimate</p>
            <p className="mt-0.5 truncate font-mono text-sm font-semibold text-(--text-primary)">{formatInr(pricingBreakdown.total)}</p>
          </div>
        </div>
      ) : (
        <>
          <VolumeDiscountProgress quantity={quantity} />

          <div className="mt-2 flex items-center gap-1.5" aria-label="Quantity presets">
            <span className="mr-auto text-xs font-medium text-(--text-primary)/45">Quick set</span>
            {quantityPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={quantity === preset}
                onClick={() => onQuantityChange(preset)}
                className={`min-h-7 min-w-11 rounded-sm border px-2 text-xs font-semibold transition-[background-color,border-color,color] duration-150 ${quantity === preset ? "border-(--color-accent) bg-(--color-accent) text-white" : "border-(--color-control-border) text-(--text-primary)/65 hover:border-(--color-accent)/50"}`}
              >
                {preset}
              </button>
            ))}
          </div>

          <div
            className="mt-1.5 grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 border-t border-(--color-control-border)/70 pt-1.5 sm:grid-cols-[minmax(132px,1.2fr)_minmax(92px,1fr)_minmax(92px,1fr)]"
            aria-live="polite"
          >
        <div className="min-w-0">
          <label
            htmlFor="configurator-quantity"
            className="mb-0.5 block text-xs font-semibold uppercase tracking-wide text-(--text-primary)/45"
          >
            Planned quantity
          </label>
          <div className="techpack-control flex h-10 w-full items-center justify-between rounded-sm border px-1.5">
            <button
              type="button"
              aria-label="Decrease quantity by 10"
              disabled={quantity <= minQuantity}
              onClick={() =>
                onQuantityChange(Math.max(minQuantity, quantity - 10))
              }
              className="flex h-8 w-8 items-center justify-center rounded-sm text-lg leading-none text-(--text-primary)/80 hover:bg-white disabled:cursor-not-allowed disabled:text-(--text-primary)/25"
            >
              −
            </button>
            <input
              id="configurator-quantity"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label={`Order quantity, minimum ${minQuantity} units`}
              value={quantityDraft}
              onChange={(event) => {
                const raw = event.target.value;
                if (/^[0-9]*$/.test(raw)) setQuantityDraft(raw);
              }}
              onBlur={() => commitQuantityDraft(quantityDraft)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitQuantityDraft(quantityDraft);
                  event.currentTarget.blur();
                }
              }}
              className="h-full w-10 bg-transparent text-center text-sm font-semibold text-(--text-primary) outline-none"
            />
            <button
              type="button"
              aria-label="Increase quantity by 10"
              onClick={() => onQuantityChange(quantity + 10)}
              className="flex h-8 w-8 items-center justify-center rounded-sm text-lg leading-none text-(--text-primary)/80 hover:bg-white"
            >
              +
            </button>
          </div>
        </div>

        <div className="min-w-0 border-l border-white/55 pl-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-(--text-primary)/45">
            Unit cost
          </div>
          <div className="mt-1 flex min-w-0 items-baseline gap-1.5">
            {pricingBreakdown.discountPercent > 0 && (
              <span className="truncate text-xs font-medium text-(--text-primary)/45 line-through">
                {formatInr(pricingBreakdown.unitPrice)}
              </span>
            )}
            <span className="truncate font-mono text-sm font-semibold text-(--text-primary)">
              {formatInr(discountedUnitCost)}
            </span>
          </div>
          {pricingBreakdown.discountPercent > 0 && (
            <p className="mt-0.5 text-xs font-medium text-[#2E7D32]">
              {pricingBreakdown.discountPercent}% off
            </p>
          )}
        </div>

        <div className="min-w-0 border-l border-white/55 pl-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-(--text-primary)/45">
            Order total
          </div>
          <div className="mt-1 truncate font-mono text-sm font-semibold text-(--text-primary)">
            {formatInr(pricingBreakdown.total)}
          </div>
        </div>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onCtaClick}
        disabled={ctaDisabled}
        className={`mt-2 min-h-11 w-full rounded-sm px-4 py-2 text-sm font-semibold leading-tight text-white transition-[background-color,box-shadow,opacity] duration-150 disabled:cursor-not-allowed disabled:bg-(--text-primary)/25 disabled:text-white/85 disabled:hover:opacity-100 ${
          flashError
            ? "bg-[#C62828] ring-2 ring-[#C62828]/40 ring-offset-2"
            : "bg-(--color-accent) hover:bg-(--color-accent-dark)"
        }`}
      >
        {ctaLabel}
      </button>

      {ctaErrorMessage && (
        <p role="alert" className="mt-1 text-center text-xs font-medium text-[#C62828]">
          {ctaErrorMessage}
        </p>
      )}
    </section>
  );
}
