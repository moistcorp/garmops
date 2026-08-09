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
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          We couldn&apos;t open this payment result
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-black/55">
          For your security, payment status is shown from your saved order. Open My Orders to check the latest verified status.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/account/orders"
            className="rounded-[4px] bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white"
          >
            View my orders →
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
