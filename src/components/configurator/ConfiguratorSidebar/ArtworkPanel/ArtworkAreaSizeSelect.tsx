import { JSX, useId, useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
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
  const selectId = useId();
  const controlled = props?.value !== undefined;
  const [internalValue, setInternalValue] = useState<PrintAreaSize>(
    props?.value ?? SIZE_ORDER[0]
  );
  const value = controlled ? (props!.value as PrintAreaSize) : internalValue;

  const handleChange = (next: PrintAreaSize) => {
    if (!controlled) setInternalValue(next);
    props?.onChange?.(next);
  };

  const dimensions = PRINT_AREA_SIZE_CHART[value];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="flex items-center gap-1 text-xs font-semibold leading-none tracking-normal text-(--text-primary)/70"
            title="The smallest ordered garment size determines the safe area used across every garment."
          >
            Artwork safe area
            <Info size={12} aria-hidden="true" className="text-(--text-primary)/35" />
          </p>
          <p className="mt-1.5 text-sm font-medium leading-tight text-(--text-primary)/80">
            Based on {value} · {dimensions.width} × {dimensions.height} cm
          </p>
        </div>
        <div className="relative shrink-0">
          <label htmlFor={selectId} className="sr-only">Change smallest garment size</label>
        <select
          id={selectId}
          value={value}
          onChange={(event) => handleChange(event.target.value as PrintAreaSize)}
          aria-label="Smallest garment size used for the artwork safe area"
          className="techpack-control h-9 w-[4.75rem] appearance-none rounded-sm border px-2.5 pr-7 text-xs font-semibold leading-none tracking-normal text-(--text-primary)/75 outline-none focus:!border-(--color-accent)/60"
        >
          {SIZE_ORDER.map((size) => {
            const dims = PRINT_AREA_SIZE_CHART[size];
            return (
              <option key={size} value={size}>
                {size} · {dims.width} × {dims.height} cm
              </option>
            );
          })}
        </select>
        <ChevronDown
          size={15}
          strokeWidth={2.2}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-(--text-primary)/45"
        />
        </div>
      </div>
    </div>
  );
}
