import { formatInr, GST_PERCENT } from "@/lib/configurator/pricing";
import { RESERVATION_FEE } from "@/lib/configurator/reservation";

interface CartSummarySidebarProps {
  subtotal: number;
  volumeDiscount: number;
  shippingFee?: number;
  gst?: number;
  rushDelivery?: boolean;
  delivery: string;
  total: number;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  disabledMessage?: string;
  sticky?: boolean;
  onDisabledNext?: () => void;
}

export function CartSummarySidebar({
  subtotal,
  volumeDiscount,
  shippingFee = 0,
  gst = 0,
  rushDelivery = false,
  delivery,
  total,
  onNext,
  nextLabel = "Next",
  nextDisabled = false,
  disabledMessage,
  sticky = true,
  onDisabledNext,
}: CartSummarySidebarProps) {
  const balanceDue = Math.max(0, total - RESERVATION_FEE);

  return (
    <aside className={`techpack-surface w-full shrink-0 self-start rounded-[4px] border border-[var(--color-rule)] p-5 lg:w-80 ${sticky ? "lg:sticky lg:top-6" : ""}`}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#111111]/50">
          Price summary
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[#111111]">Estimated total</h2>
      </div>

      <div className="mt-5 space-y-3 text-sm text-[#111111]">
        <div className="flex justify-between">
          <span>Merchandise subtotal</span>
          <span className="font-mono">{formatInr(subtotal)}</span>
        </div>
        {volumeDiscount > 0 && (
          <div className="flex justify-between rounded-[4px] border border-white/55 bg-[#EAF7EA]/65 px-2 py-1.5 font-medium text-[#1B7F36] ">
            <span>Volume discount</span>
            <span className="font-mono">-{formatInr(volumeDiscount)}</span>
          </div>
        )}
        {shippingFee > 0 && (
          <div className="flex justify-between text-[#111111]/70">
            <span>Rush delivery</span>
            <span className="font-mono">{formatInr(shippingFee)}</span>
          </div>
        )}
        {rushDelivery && shippingFee === 0 && (
          <div className="flex justify-between text-[#111111]/70">
            <span>Rush delivery</span>
            <span>Included in unit price</span>
          </div>
        )}
        <div className="flex justify-between text-[#111111]/70">
          <span>GST ({GST_PERCENT}%)</span>
          <span className="font-mono">{formatInr(gst)}</span>
        </div>
        <div className="flex justify-between text-[#111111]/70">
          <span>Delivery</span>
          <span className="max-w-[150px] text-right font-mono">{delivery}</span>
        </div>
        <div className="flex justify-between border-t border-[#E5E5E5] pt-3 text-base font-semibold">
          <span>Estimated total</span>
          <span className="font-mono">{formatInr(total)}</span>
        </div>
      </div>

      <div className="techpack-panel mt-4 rounded-[4px] border !border-[var(--color-accent)]/25 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[#111111]">Due today</span>
          <span className="font-mono text-lg font-bold text-[var(--color-accent-dark)]">
            {formatInr(RESERVATION_FEE)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-[#111111]/60">
          <span>Estimated balance later</span>
          <span className="font-mono">{formatInr(balanceDue)}</span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[#111111]/60">
          Credited against the final invoice after artwork, shipping and production feasibility are reviewed.
        </p>
      </div>

      <p className="mt-3 text-[11px] text-[#111111]/60">
        Prices include {GST_PERCENT}% GST. Shipping is confirmed after address and feasibility review.
      </p>

      {onNext && (
        <>
        <button
          type="button"
          onClick={() => {
            if (nextDisabled) { onDisabledNext?.(); return; }
            onNext();
          }}
          aria-disabled={nextDisabled}
          className={`mt-5 w-full rounded-[4px] py-3 font-mono text-xs font-semibold uppercase tracking-[0.05em] ${nextDisabled ? "bg-[#E5E5E5] text-[#111111]/40" : "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-dark)]"}`}
        >
          {nextLabel}
        </button>
        {nextDisabled && disabledMessage && (
          <p className="mt-2 text-center text-xs leading-relaxed text-[#111111]/55">{disabledMessage}</p>
        )}
        </>
      )}
    </aside>
  );
}
