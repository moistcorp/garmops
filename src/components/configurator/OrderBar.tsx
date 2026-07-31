"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, TrendingUp } from "lucide-react";
import type { DeliveryFeasibility } from "@/lib/configurator/deliveryFeasibility";
import type { PricingBreakdown } from "@/lib/configurator/pricing";
import { formatInr } from "@/lib/configurator/pricing";
import {
  VOLUME_DISCOUNT_TIERS,
  type VolumeDiscountTier,
} from "@/lib/pricingRules";
import { RESERVATION_FEE } from "@/lib/configurator/reservation";

export interface OrderBarProps {
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  minQuantity?: number;
  ctaLabel: string;
  onCtaClick?: () => void;
  pricingBreakdown: PricingBreakdown;
  preferredTargetDate?: string;
  onPreferredTargetDateChange?: (date: string) => void;
  deliveryFeasibility?: DeliveryFeasibility;
  ctaErrorMessage?: string | null;
  ctaErrorNonce?: number;
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

function VolumeDiscountProgress({ quantity }: { quantity: number }) {
  const state = getVolumeDiscountProgress(quantity);
  const hasNextTier = state.nextDiscountPercent !== null && state.progressMax !== null;
  const message = state.isHighestTier
    ? `${state.currentDiscountPercent}% volume discount applied · Highest discount tier`
    : hasNextTier && state.currentDiscountPercent > 0
      ? `${state.currentDiscountPercent}% volume discount applied · ${state.unitsToNextTier} more unit${state.unitsToNextTier === 1 ? "" : "s"} to unlock ${state.nextDiscountPercent}%`
      : hasNextTier
        ? `${state.unitsToNextTier <= 20 ? "Only " : "Add "}${state.unitsToNextTier} more unit${state.unitsToNextTier === 1 ? "" : "s"} to unlock ${state.nextDiscountPercent}% off`
        : "Volume pricing updates automatically in the Sizes & quantity step";

  return (
    <div className="configurator-glass-subtle rounded-[4px] px-3 py-2.5">
      <div className="flex items-start gap-2 text-[11px] font-semibold leading-snug text-[#1D49B4]">
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
          className="mt-2 h-1.5 overflow-hidden rounded-[4px] bg-[#DCE8E4]"
        >
          <div
            className="h-full rounded-[4px] bg-[var(--color-accent)] transition-[width] duration-200"
            style={{ width: `${Math.round(state.progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function tomorrowInputValue(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function OrderBar({
  quantity,
  onQuantityChange,
  minQuantity = 50,
  ctaLabel,
  onCtaClick,
  pricingBreakdown,
  preferredTargetDate,
  onPreferredTargetDateChange,
  deliveryFeasibility,
  ctaErrorMessage,
  ctaErrorNonce,
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

  return (
    <section
      aria-label="Order estimate"
      className="configurator-glass-stack configurator-glass-surface grid gap-2.5 rounded-[4px] border p-3"
    >
      <VolumeDiscountProgress quantity={quantity} />

      <div
        className="grid grid-cols-3 divide-x divide-white/55 text-xs"
        aria-live="polite"
      >
        <div className="min-w-0 pr-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#111111]/45">
            Unit cost
          </div>
          <div className="mt-1 flex min-w-0 items-baseline gap-1.5">
            {pricingBreakdown.discountPercent > 0 && (
              <span className="truncate text-[10px] font-medium text-[#111111]/45 line-through">
                {formatInr(pricingBreakdown.unitPrice)}
              </span>
            )}
            <span className="truncate font-mono text-sm font-semibold text-[#111111]">
              {formatInr(discountedUnitCost)}
            </span>
          </div>
          {pricingBreakdown.discountPercent > 0 && (
            <p className="mt-0.5 text-[10px] font-medium text-[#2E7D32]">
              {pricingBreakdown.discountPercent}% off
            </p>
          )}
        </div>

        <div className="min-w-0 px-2">
          <label
            htmlFor="configurator-target-date"
            className="block text-[10px] font-semibold uppercase tracking-wide text-[#111111]/45"
          >
            Target delivery date
          </label>
          <div className="mt-1 flex min-w-0 items-center gap-1">
            {preferredTargetDate && deliveryFeasibility?.status === "comfortable" ? (
              <CheckCircle2 size={13} className="shrink-0 text-[#2E7D32]" aria-hidden="true" />
            ) : preferredTargetDate ? (
              <CircleAlert size={13} className="shrink-0 text-[#8A6212]" aria-hidden="true" />
            ) : null}
            <input
              id="configurator-target-date"
              type="date"
              min={tomorrowInputValue()}
              value={preferredTargetDate ?? ""}
              onChange={(event) => onPreferredTargetDateChange?.(event.target.value)}
              className="h-6 min-w-0 w-full bg-transparent text-xs font-semibold text-[#111111] outline-none"
            />
          </div>
          <p
            className="mt-0.5 truncate text-[10px] text-[#111111]/50"
            title={deliveryFeasibility?.detail}
          >
            {preferredTargetDate
              ? deliveryFeasibility?.label ?? "Timing review"
              : "Select a date"}
          </p>
        </div>

        <div className="min-w-0 pl-2 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#111111]/45">
            Due today
          </div>
          <div className="mt-1 truncate font-mono text-sm font-semibold text-[#111111]">
            {formatInr(RESERVATION_FEE)}
          </div>
          <p className="mt-0.5 text-[10px] text-[#111111]/45">Reservation fee</p>
        </div>
      </div>

      <div className="flex flex-col items-stretch justify-between gap-2 border-t border-white/55 pt-2 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <label
            htmlFor="configurator-quantity"
            className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wide text-[#111111]/45"
          >
            Quantity
          </label>
          <div className="configurator-glass-control flex h-10 w-full items-center justify-between rounded-[4px] border px-1.5 sm:w-32">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity <= minQuantity}
              onClick={() =>
                onQuantityChange(Math.max(minQuantity, quantity - 1))
              }
              className="flex h-8 w-8 items-center justify-center rounded-[4px] text-lg leading-none text-[#111111]/80 hover:bg-white disabled:cursor-not-allowed disabled:text-[#111111]/25"
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
              className="h-full w-10 bg-transparent text-center text-sm font-semibold text-[#111111] outline-none"
            />
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => onQuantityChange(quantity + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-[4px] text-lg leading-none text-[#111111]/80 hover:bg-white"
            >
              +
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onCtaClick}
          className={`min-h-10 w-full shrink-0 rounded-[4px] px-5 text-sm font-semibold text-white transition-all hover:opacity-90 sm:w-auto ${
            flashError
              ? "bg-[#C62828] ring-2 ring-[#C62828]/40 ring-offset-2"
              : "bg-[var(--color-accent)] hover:bg-[var(--color-accent-dark)]"
          }`}
        >
          {ctaLabel}
        </button>
      </div>

      {ctaErrorMessage && (
        <p role="alert" className="text-right text-[11px] font-medium text-[#C62828]">
          {ctaErrorMessage}
        </p>
      )}
    </section>
  );
}
