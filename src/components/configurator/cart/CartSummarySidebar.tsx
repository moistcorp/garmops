import { formatInr } from "@/lib/configurator/pricing";

interface CartSummarySidebarProps {
  subtotal: number;
  volumeDiscount: number;
  delivery: string;
  total: number;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}

export function CartSummarySidebar({
  subtotal,
  volumeDiscount,
  delivery,
  total,
  onNext,
  nextLabel = "Next",
  nextDisabled = false,
}: CartSummarySidebarProps) {
  return (
    <aside className="w-full shrink-0 self-start rounded-lg border border-[#E5E5E5] bg-white p-5 lg:w-80">
      <div className="space-y-2 text-sm text-[#111111]">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatInr(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Volume discount</span>
          <span>-{formatInr(volumeDiscount)}</span>
        </div>
        <div className="flex justify-between text-[#111111]/70">
          <span>Delivery</span>
          <span>{delivery}</span>
        </div>
        <div className="flex justify-between border-t border-[#E5E5E5] pt-2 text-base font-semibold">
          <span>Total</span>
          <span>{formatInr(total)}</span>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-[#111111]/60">
        All prices excl. VAT and shipping costs.
      </p>

      <p className="mt-3 text-xs text-[#111111]">
        Estimated delivery: 3–4 weeks. Items will be delivered together.
      </p>

      {onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="mt-5 w-full rounded-md bg-[#111111] py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[#E5E5E5] disabled:text-[#111111]/40"
        >
          {nextLabel}
        </button>
      )}
    </aside>
  );
}
