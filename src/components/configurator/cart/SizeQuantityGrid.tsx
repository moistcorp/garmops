import { formatInr } from "@/lib/configurator/pricing";

export type Size = string;

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;

export interface SizeQuantityGridProps {
  value: Record<Size, number>;
  onChange: (size: Size, qty: number) => void;
  unitPrice: number;
  minimumUnits?: number;
  sizes?: readonly Size[];
  idPrefix?: string;
}

const ALLOCATION_PRESETS = {
  recommended: [0.1, 0.25, 0.3, 0.2, 0.1, 0.05],
  equal: [1, 1, 1, 1, 1, 1],
  larger: [0.04, 0.12, 0.24, 0.3, 0.2, 0.1],
} as const;

function splitByWeights(total: number, sizeCount: number, weights: readonly number[]): number[] {
  const active = weights.slice(0, sizeCount);
  const weightTotal = active.reduce((sum, value) => sum + value, 0) || 1;
  const result = active.map((weight) => Math.floor((total * weight) / weightTotal));
  let remainder = total - result.reduce((sum, value) => sum + value, 0);
  let index = 0;
  while (remainder > 0) { result[index % result.length] += 1; remainder -= 1; index += 1; }
  return result;
}

export function SizeQuantityGrid({
  value,
  onChange,
  unitPrice,
  minimumUnits = 50,
  sizes = SIZES,
  idPrefix = "item",
}: SizeQuantityGridProps) {
  const totalUnits = sizes.reduce((sum, size) => sum + (value[size] || 0), 0);
  const columnsClass = sizes.length === 1 ? "grid-cols-1" : "grid-cols-6";
  const inputId = (size: Size) =>
    `qty-${idPrefix}-${size.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  function handleInputChange(size: Size, raw: string) {
    const parsed = Number(raw);
    const safe = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
    onChange(size, safe);
  }

  function applyPreset(weights: readonly number[]) {
    const targetTotal = Math.max(minimumUnits, totalUnits);
    const quantities = splitByWeights(targetTotal, sizes.length, weights);
    sizes.forEach((size, index) => onChange(size, quantities[index] ?? 0));
  }

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-end gap-3 text-xs text-[#111111]/60">
        <span>Minimum {minimumUnits} units</span>
        <span className="font-medium text-[#111111]">{totalUnits} units</span>
      </div>
      {sizes.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#111111]/45">Quick allocation</span>
          <button type="button" onClick={() => applyPreset(ALLOCATION_PRESETS.recommended)} className="rounded-full border border-[#E5E5E5] px-2.5 py-1 text-[11px] font-semibold text-[#111111]/65 hover:border-[var(--color-teal)]">Recommended mix</button>
          <button type="button" onClick={() => applyPreset(ALLOCATION_PRESETS.equal)} className="rounded-full border border-[#E5E5E5] px-2.5 py-1 text-[11px] font-semibold text-[#111111]/65 hover:border-[var(--color-teal)]">Equal split</button>
          <button type="button" onClick={() => applyPreset(ALLOCATION_PRESETS.larger)} className="rounded-full border border-[#E5E5E5] px-2.5 py-1 text-[11px] font-semibold text-[#111111]/65 hover:border-[var(--color-teal)]">More L–XXL</button>
        </div>
      )}
      <div className={`grid ${columnsClass} gap-px overflow-hidden rounded-md border border-[#E5E5E5] bg-[#E5E5E5]`}>
        {sizes.map((size) => (
          <div key={size} className="bg-[#F7F7F7] px-2 py-2 text-center text-xs font-medium tracking-wide text-[#111111]">
            {size}
          </div>
        ))}
        {sizes.map((size) => (
          <div key={`${size}-input`} className="bg-white px-1.5 py-1.5">
            <label className="sr-only" htmlFor={inputId(size)}>
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
                id={inputId(size)}
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
