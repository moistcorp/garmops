"use client";

export interface PaymentMethodSelectProps {
  value?: string; // selected payment method ID
  onChange: (methodId: string) => void;
}

const PAYU_METHOD_ID = "payu";

export function PaymentMethodSelect({ value, onChange }: PaymentMethodSelectProps) {
  const selected = value === PAYU_METHOD_ID;

  return (
    <div>
      <h3 className="text-sm font-medium text-[#111111] mb-3">
        Select payment method
      </h3>
      <button
        type="button"
        onClick={() => onChange(PAYU_METHOD_ID)}
        aria-pressed={selected}
        className={`w-full text-left flex items-center justify-between gap-4 rounded-full border px-5 py-3 transition-colors ${
          selected
            ? "border-[var(--color-teal)] bg-white"
            : "border-[#E5E5E5] bg-[#F7F7F7] hover:border-[var(--color-teal)]"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${
              selected ? "border-[var(--color-teal)]" : "border-[#E5E5E5]"
            }`}
          >
            {selected && <span className="h-2 w-2 rounded-full bg-[var(--color-teal)]" />}
          </span>
          <div>
            <p className="text-sm font-medium text-[#111111]">PayU</p>
            <p className="text-xs text-[#111111]/60">
              Secure card, UPI, and netbanking checkout
            </p>
          </div>
        </div>
      </button>
      <p className="mt-2 text-xs text-[#111111]/50">
        More payment methods may be added in the future.
      </p>
    </div>
  );
}
