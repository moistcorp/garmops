import Link from "next/link";
import { CircleAlert } from "lucide-react";

export default function PaymentResultUnavailable() {
  return (
    <div className="techpack-canvas flex min-h-[80vh] items-center justify-center px-4 py-10 sm:px-6">
      <div className="techpack-surface w-full max-w-xl rounded-[4px] border p-7 text-center sm:p-10">
        <CircleAlert
          size={48}
          className="mx-auto text-amber-600"
          aria-hidden="true"
        />
        <p className="mt-6 text-xs uppercase tracking-[0.2em] text-[var(--color-accent)]">
          Verified order status
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Payment result unavailable
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-black/55">
          This payment-result link is invalid or has expired. For security, Garmops does not reconstruct payment status from the URL or browser storage.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-black/55">
          Open My orders to see the latest status verified against your saved order and PayU payment attempt.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/account/orders"
            className="rounded-[4px] bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white"
          >
            Open My orders
          </Link>
          <Link
            href="/contact"
            className="rounded-[4px] border border-black/10 px-5 py-3 text-sm font-semibold"
          >
            Contact support
          </Link>
        </div>
      </div>
    </div>
  );
}
