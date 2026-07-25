import { formatInr, GST_PERCENT } from "@/lib/configurator/pricing";

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
}: CartSummarySidebarProps) {
  return (
    <aside className="w-full shrink-0 self-start rounded-lg border border-[#E5E5E5] bg-white p-5 shadow-sm lg:w-80">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#111111]/50">
          Invoice Summary
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[#111111]">Estimated Total</h2>
      </div>

      <div className="mt-5 space-y-3 text-sm text-[#111111]">
        <div className="flex justify-between">
          <span>Merchandise subtotal</span>
          <span>{formatInr(subtotal)}</span>
        </div>
        {volumeDiscount > 0 && (
          <div className="flex justify-between rounded-md bg-[#EAF7EA] px-2 py-1.5 font-medium text-[#1B7F36]">
            <span>Volume discount</span>
            <span>-{formatInr(volumeDiscount)}</span>
          </div>
        )}
        {shippingFee > 0 && (
          <div className="flex justify-between text-[#111111]/70">
            <span>Rush delivery</span>
            <span>{formatInr(shippingFee)}</span>
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
          <span>{formatInr(gst)}</span>
        </div>
        <div className="flex justify-between text-[#111111]/70">
          <span>Delivery</span>
          <span>{delivery}</span>
        </div>
        <div className="flex justify-between border-t border-[#E5E5E5] pt-3 text-base font-semibold">
          <span>Total</span>
          <span>{formatInr(total)}</span>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-[#111111]/60">
        Prices include {GST_PERCENT}% GST. Rush Delivery adds ₹75 per unit when enabled.
      </p>

      <p className="mt-3 text-xs text-[#111111]">
        Items in this order are produced and shipped together.
      </p>

      {onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="mt-5 w-full rounded-full bg-[var(--color-teal)] py-2.5 text-sm font-medium text-white hover:bg-[var(--color-teal-dark)] disabled:cursor-not-allowed disabled:bg-[#E5E5E5] disabled:text-[#111111]/40"
        >
          {nextLabel}
        </button>
      )}
    </aside>
  );
}
