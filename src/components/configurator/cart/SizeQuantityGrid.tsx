import {
  MAX_CONFIGURATION_QUANTITY,
  parseSizeQuantityInput,
} from "@/lib/configurator/sizeQuantity";

export type Size = string;

export const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export interface SizeQuantityGridProps {
  value: Record<Size, number>;
  onChange: (size: Size, qty: number) => void;
  minimumUnits?: number;
  maximumUnits?: number;
  sizes?: readonly Size[];
  idPrefix?: string;
}

function pieceLabel(quantity: number): string {
  return `${quantity.toLocaleString("en-IN")} ${quantity === 1 ? "piece" : "pieces"}`;
}

export function SizeQuantityGrid({
  value,
  onChange,
  minimumUnits = 50,
  maximumUnits = MAX_CONFIGURATION_QUANTITY,
  sizes = SIZES,
  idPrefix = "item",
}: SizeQuantityGridProps) {
  const totalUnits = sizes.reduce((sum, size) => sum + (value[size] || 0), 0);
  const isOneSize = sizes.length === 1 && sizes[0] === "One Size";
  const inputId = (size: Size) =>
    `qty-${idPrefix}-${size.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  function maximumForSize(size: Size): number {
    return Math.max(0, maximumUnits - (totalUnits - (value[size] ?? 0)));
  }

  function handleInputChange(size: Size, raw: string) {
    onChange(
      size,
      parseSizeQuantityInput(raw, value[size] ?? 0, maximumForSize(size)),
    );
  }

  function quantityControl(size: Size) {
    const quantity = value[size] ?? 0;
    const maximum = maximumForSize(size);
    return (
      <div className="ml-auto flex h-10 w-full max-w-52 items-center justify-between border border-(--color-rule) bg-white">
        <button
          type="button"
          aria-label={`Decrease ${isOneSize ? "quantity" : `${size} quantity`}`}
          disabled={quantity <= 0}
          onClick={() => onChange(size, Math.max(0, quantity - 1))}
          className="flex h-full w-10 items-center justify-center border-r border-(--color-rule) text-lg leading-none text-(--text-primary)/80 hover:bg-[#F7F7F7] disabled:cursor-not-allowed disabled:text-(--text-primary)/25"
        >
          −
        </button>
        <input
          id={inputId(size)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={quantity}
          onChange={(event) => handleInputChange(size, event.target.value)}
          aria-describedby={`${inputId(size)}-limit`}
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-center font-mono text-sm font-semibold tabular-nums text-(--text-primary) outline-none focus:bg-(--color-accent)/5"
        />
        <span id={`${inputId(size)}-limit`} className="sr-only">
          Whole numbers from zero to {maximum.toLocaleString("en-IN")}
        </span>
        <button
          type="button"
          aria-label={`Increase ${isOneSize ? "quantity" : `${size} quantity`}`}
          disabled={totalUnits >= maximumUnits}
          onClick={() => onChange(size, Math.min(maximum, quantity + 1))}
          className="flex h-full w-10 items-center justify-center border-l border-(--color-rule) text-lg leading-none text-(--text-primary)/80 hover:bg-[#F7F7F7] disabled:cursor-not-allowed disabled:text-(--text-primary)/25"
        >
          +
        </button>
      </div>
    );
  }

  if (isOneSize) {
    const size = sizes[0];
    return (
      <div className="w-full">
        <div className="border-y border-(--color-rule) py-2.5">
          <div className="flex items-center justify-between gap-5">
            <label htmlFor={inputId(size)} className="text-sm font-semibold text-(--text-primary)">
              Quantity
            </label>
            {quantityControl(size)}
          </div>
        </div>
        <p className="mt-3 text-xs text-(--text-primary)/55">
          Minimum order: {pieceLabel(minimumUnits)}. Minimum applies to this product configuration.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(180px,208px)] border-y border-(--color-rule) bg-[#F7F7F7] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-(--text-primary)/50">
        <span>Size</span>
        <span className="text-center">Quantity</span>
      </div>
      <div className="divide-y divide-(--color-rule) border-b border-(--color-rule)">
        {sizes.map((size) => (
          <div
            key={size}
            className="grid grid-cols-[minmax(0,1fr)_minmax(180px,208px)] items-center px-3 py-1.5"
          >
            <label htmlFor={inputId(size)} className="font-mono text-sm font-semibold text-(--text-primary)">
              {size}
            </label>
            {quantityControl(size)}
          </div>
        ))}
      </div>
    </div>
  );
}
