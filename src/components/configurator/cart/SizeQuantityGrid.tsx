import { formatInr } from "@/lib/configurator/pricing";

export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

export const SIZES: Size[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export interface SizeQuantityGridProps {
  value: Record<Size, number>;
  onChange: (size: Size, qty: number) => void;
  unitPrice: number;
}

export function SizeQuantityGrid({ value, onChange, unitPrice }: SizeQuantityGridProps) {
  const totalUnits = SIZES.reduce((sum, size) => sum + (value[size] || 0), 0);

  function handleInputChange(size: Size, raw: string) {
    const parsed = parseInt(raw, 10);
    const safe = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
    onChange(size, safe);
  }

  return (
    <div className="w-full">
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
            <input
              id={`qty-${size}`}
              type="number"
              inputMode="numeric"
              min={0}
              value={value[size] ?? 0}
              onChange={(e) => handleInputChange(size, e.target.value)}
              className="w-full rounded border border-[#E5E5E5] bg-white px-1.5 py-1 text-center text-sm text-[#111111] focus:border-[#111111] focus:outline-none"
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[#E5E5E5] pt-3 text-sm">
        <div className="text-[#111111]">
          <span className="font-medium">Total units:</span>{' '}
          <span>{totalUnits}</span>
        </div>
        <div className="text-[#111111]">
          <span className="font-medium">Price/unit:</span>{' '}
          <span>{formatInr(unitPrice)}</span>
        </div>
      </div>
    </div>
  );
}
