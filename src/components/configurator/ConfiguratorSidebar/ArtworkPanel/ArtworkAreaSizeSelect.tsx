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

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as PrintAreaSize;
    if (!controlled) setInternalValue(next);
    props?.onChange?.(next);
  };

  const maxSize = SIZE_ORDER[SIZE_ORDER.length - 1];

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="artwork-area-size-select" className="text-sm font-medium">
        Smallest Size (Sets Artwork Area)
      </label>
      <select
        id="artwork-area-size-select"
        value={value}
        onChange={handleChange}
        className="rounded border px-2 py-1 text-sm"
      >
        {SIZE_ORDER.map((size) => {
          const dims = PRINT_AREA_SIZE_CHART[size];
          return (
            <option key={size} value={size}>
              {size} — {dims.width}×{dims.height}cm
            </option>
          );
        })}
      </select>
      <p className="text-xs text-muted-foreground">
        Sizes to order: {value} - {maxSize}
      </p>
    </div>
  );
}