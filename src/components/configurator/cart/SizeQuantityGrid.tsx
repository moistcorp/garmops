import { formatInr } from "@/lib/configurator/pricing";

export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

export const SIZES: Size[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export interface SizeQuantityGridProps {
  value: Record<Size, number>;
  onChange: (size: Size, qty: number) => void;
  unitPrice: number;
  minimumUnits?: number;
}

export function SizeQuantityGrid({
  value,
  onChange,
  unitPrice,
  minimumUnits = 50,
}: SizeQuantityGridProps) {
  const totalUnits = SIZES.reduce((sum, size) => sum + (value[size] || 0), 0);

  function handleInputChange(size: Size, raw: string) {
    const parsed = parseInt(raw, 10);
    const safe = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
    onChange(size, safe);
  }

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-end gap-3 text-xs text-[#111111]/60">
        <span>Minimum {minimumUnits} units</span>
        <span className="font-medium text-[#111111]">{totalUnits} units</span>
      </div>
      <div className="grid grid-cols-6 gap-px overflow-hidden rounded-md border border-[#E5E5E5] bg-[#E5E5E5]">
        {SIZES.map((size) => (
          <div key={size} className="bg-[#F7F7F7] px-2 py-2 text-center text-xs font-medium tracking-wide text-[#111111]">
            {size}
          </div>
        ))}
        {SIZES.map((size) => (
          <div key={`${size}-input`} className="bg-white px-1.5 py-1.5">
            <label className="sr-only" htmlFor={`qty-${size}`}>
              Quantity for size {size}
            </label>
            <div className="flex h-9 items-center justify-between rounded-md bg-[#F7F7F7] px-1">
              <button
                type="button"
                aria-label={`Decrease ${size} quantity`}
                disabled={totalUnits <= minimumUnits || (value[size] ?? 0) <= 0}
                onClick={() => onChange(size, Math.max(0, (value[size] ?? 0) - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-md text-lg leading-none text-[#111111]/80 hover:bg-white disabled:cursor-not-allowed disabled:text-[#111111]/25"
              >
                −
              </button>
              <input
                id={`qty-${size}`}
                type="number"
                inputMode="numeric"
                min={0}
                value={value[size] ?? 0}
                onChange={(e) => handleInputChange(size, e.target.value)}
                className="h-full w-8 bg-transparent text-center text-sm font-medium text-[#111111] outline-none"
              />
              <button
                type="button"
                aria-label={`Increase ${size} quantity`}
                onClick={() => onChange(size, (value[size] ?? 0) + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-lg leading-none text-[#111111]/80 hover:bg-white"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-end border-t border-[#E5E5E5] pt-3 text-sm">
        <div className="text-[#111111]">
          <span className="font-medium">Price/unit:</span>{' '}
          <span>{formatInr(unitPrice)}</span>
        </div>
      </div>
    </div>
  );
}
