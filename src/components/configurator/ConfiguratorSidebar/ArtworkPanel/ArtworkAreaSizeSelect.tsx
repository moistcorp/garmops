import { JSX, useState } from 'react';
import type { PrintAreaSize } from '@/lib/configurator/types/configurator';
import { PRINT_AREA_SIZE_CHART } from '@/lib/configurator/sizecharts';

// Explicit display/order list — PRINT_AREA_SIZE_CHART is a Record and its
// iteration order isn't part of its contract, so ordering for the dropdown
// and for the "max" side of the helper text is defined here.
const SIZE_ORDER: PrintAreaSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export interface ArtworkAreaSizeSelectProps {
  value?: PrintAreaSize;
  onChange?: (size: PrintAreaSize) => void;
}

export function ArtworkAreaSizeSelect(props?: ArtworkAreaSizeSelectProps): JSX.Element {
  const controlled = props?.value !== undefined;
  const [internalValue, setInternalValue] = useState<PrintAreaSize>(
    props?.value ?? SIZE_ORDER[0]
  );
  const value = controlled ? (props!.value as PrintAreaSize) : internalValue;

  const handleChange = (next: PrintAreaSize) => {
    if (!controlled) setInternalValue(next);
    props?.onChange?.(next);
  };

  const maxSize = SIZE_ORDER[SIZE_ORDER.length - 1];

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">Smallest Size (Sets Artwork Area)</span>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Smallest artwork size">
        {SIZE_ORDER.map((size) => {
          const dims = PRINT_AREA_SIZE_CHART[size];
          const selected = value === size;
          return (
            <button
              key={size}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => handleChange(size)}
              className={`rounded-md border px-2 py-2 text-left text-xs transition-colors ${
                selected
                  ? 'border-[#111111] bg-[#111111] text-white'
                  : 'border-[#E5E5E5] bg-white text-[#111111] hover:border-[#111111]'
              }`}
            >
              <span className="block font-semibold">{size}</span>
              <span className={selected ? 'text-white/70' : 'text-[#111111]/50'}>
                {dims.width}×{dims.height}cm
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Sizes to order: {value} - {maxSize}
      </p>
    </div>
  );
}
