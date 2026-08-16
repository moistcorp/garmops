import { ArrowRight, LoaderCircle } from "lucide-react";
import { formatInr } from "@/lib/configurator/pricing";

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
  nextLoading?: boolean;
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
  nextLoading = false,
  disabledMessage,
  onDisabledNext,
  sticky = true,
}: CartSummarySidebarProps) {
  return (
    <aside className={`techpack-panel rounded-sm border p-5 ${sticky ? "lg:sticky lg:top-36" : ""}`}>
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-(--color-accent)">
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
        <SummaryRow label="GST (5% / 12% as applicable)" value={formatInr(gst)} />
        <div className="border-t border-(--color-rule) pt-3">
          <SummaryRow label="Order total" value={formatInr(total)} strong />
        </div>
        {totalPieces !== undefined && (
          <p className="text-right text-xs text-(--text-primary)/55">
            {totalPieces.toLocaleString("en-IN")} pieces
          </p>
        )}
      </div>

      {onNext && (
        <>
          <button
            type="button"
            aria-disabled={nextDisabled || nextLoading}
            aria-busy={nextLoading}
            disabled={nextLoading || (nextDisabled && !onDisabledNext)}
            onClick={nextLoading ? undefined : nextDisabled ? onDisabledNext : onNext}
            className={`mt-5 flex w-full items-center justify-center gap-2 rounded-sm px-4 py-3 text-sm font-semibold transition-colors ${
              nextDisabled && !nextLoading
                ? "cursor-not-allowed bg-[#E5E5E5] text-(--text-primary)/45"
                : nextLoading
                  ? "cursor-wait bg-(--color-accent) text-white/85"
                  : "bg-(--color-accent) text-white hover:bg-(--color-accent-dark)"
            }`}
          >
            {nextLoading ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}
            <span>{nextLabel}</span>
            {!nextLoading ? <ArrowRight size={16} aria-hidden="true" /> : null}
          </button>
          {nextDisabled && disabledMessage && (
            <p className="mt-2 text-center text-xs text-(--text-primary)/50">{disabledMessage}</p>
          )}
        </>
      )}
    </aside>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${strong ? "font-semibold text-(--text-primary)" : "text-(--text-primary)/65"}`}>
      <span>{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}
