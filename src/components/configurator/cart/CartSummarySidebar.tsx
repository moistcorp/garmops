import { ArrowRight } from "lucide-react";
import { formatInr } from "@/lib/configurator/pricing";
import { formatGstRate } from "@/lib/tax";

interface CartSummarySidebarProps {
  subtotal: number;
  volumeDiscount: number;
  shippingFee: number;
  rushFee?: number;
  promoDiscount?: number;
  gst: number;
  delivery?: string;
  total: number;
  totalPieces?: number;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  disabledMessage?: string;
  onDisabledNext?: () => void;
  sticky?: boolean;
}

export function CartSummarySidebar({
  subtotal,
  volumeDiscount,
  shippingFee,
  rushFee = 0,
  promoDiscount = 0,
  gst,
  total,
  totalPieces,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
  disabledMessage,
  onDisabledNext,
  sticky = true,
}: CartSummarySidebarProps) {
  return (
    <aside className={`techpack-panel rounded-[4px] border p-5 ${sticky ? "lg:sticky lg:top-36" : ""}`}>
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
        Order value
      </p>
      <div className="mt-4 space-y-3 text-sm">
        <SummaryRow label="Configured merchandise" value={formatInr(subtotal)} />
        {volumeDiscount > 0 && (
          <SummaryRow label="Volume discount" value={`− ${formatInr(volumeDiscount)}`} />
        )}
        {rushFee > 0 && (
          <SummaryRow label="Rush delivery" value={`+ ${formatInr(rushFee)}`} />
        )}
        {promoDiscount > 0 && (
          <SummaryRow label="Promo discount" value={`− ${formatInr(promoDiscount)}`} />
        )}
        <SummaryRow label="Shipping" value={shippingFee === 0 ? "Free" : formatInr(shippingFee)} />
        <SummaryRow label={`GST (${formatGstRate()})`} value={formatInr(gst)} />
        <div className="border-t border-[var(--color-rule)] pt-3">
          <SummaryRow label="Order total" value={formatInr(total)} strong />
        </div>
        {totalPieces !== undefined && (
          <p className="text-right text-xs text-[var(--text-primary)]/55">
            {totalPieces.toLocaleString("en-IN")} pieces
          </p>
        )}
      </div>

      {onNext && (
        <>
          <button
            type="button"
            aria-disabled={nextDisabled}
            disabled={nextDisabled && !onDisabledNext}
            onClick={nextDisabled ? onDisabledNext : onNext}
            className={`mt-5 flex w-full items-center justify-center gap-2 rounded-[4px] px-4 py-3 text-sm font-semibold transition-colors ${
              nextDisabled
                ? "cursor-not-allowed bg-[#E5E5E5] text-[var(--text-primary)]/45"
                : "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-dark)]"
            }`}
          >
            {nextLabel}
            <ArrowRight size={16} />
          </button>
          {nextDisabled && disabledMessage && (
            <p className="mt-2 text-center text-xs text-[var(--text-primary)]/50">{disabledMessage}</p>
          )}
        </>
      )}
    </aside>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${strong ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-primary)]/65"}`}>
      <span>{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}
