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
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">
        Select payment method
      </h3>
      <button
        type="button"
        onClick={() => onChange(PAYU_METHOD_ID)}
        aria-pressed={selected}
        className={`flex w-full items-center justify-between gap-4 rounded-[4px] border px-5 py-3 text-left transition-colors ${
          selected
            ? "techpack-selected"
            : "techpack-control hover:!border-[var(--color-accent)]"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-4 w-4 items-center justify-center rounded-[4px] border ${
              selected ? "border-white/80" : "border-[#E5E5E5]"
            }`}
          >
            {selected && <span className="h-2 w-2 rounded-[4px] bg-white" />}
          </span>
          <div>
            <p className={`text-sm font-medium ${selected ? "text-white" : "text-[var(--text-primary)]"}`}>PayU</p>
            <p className={`text-xs ${selected ? "text-white/75" : "text-[var(--text-primary)]/60"}`}>
              Secure card, UPI, and netbanking checkout
            </p>
          </div>
        </div>
      </button>
      <p className="mt-2 text-xs text-[var(--text-primary)]/50">
        More payment methods may be added in the future.
      </p>
    </div>
  );
}
