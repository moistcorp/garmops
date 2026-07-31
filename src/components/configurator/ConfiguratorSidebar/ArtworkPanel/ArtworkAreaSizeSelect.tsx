import { JSX, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
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

  const maxSize = SIZE_ORDER[SIZE_ORDER.length - 1];

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={selectId}
        className="text-xs font-semibold leading-none tracking-normal text-[#111111]/70"
      >
        Smallest Size{" "}
        <span className="font-normal text-[#111111]/45">
          (sets artwork area)
        </span>
      </label>
      <div className="relative">
        <select
          id={selectId}
          value={value}
          onChange={(event) => handleChange(event.target.value as PrintAreaSize)}
          className="techpack-control h-11 w-full appearance-none rounded-[4px] border px-3 pr-9 text-sm font-medium leading-none tracking-normal text-[#111111]/80 outline-none focus:!border-[var(--color-accent)]/60"
        >
          {SIZE_ORDER.map((size) => {
            const dims = PRINT_AREA_SIZE_CHART[size];
            return (
              <option key={size} value={size}>
                {size} — {dims.width} × {dims.height} cm
              </option>
            );
          })}
        </select>
        <ChevronDown
          size={15}
          strokeWidth={2.2}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#111111]/45"
        />
      </div>
      <p className="text-xs leading-relaxed tracking-normal text-[#111111]/45">
        Sizes to order: {value}–{maxSize}. The dotted boundary updates automatically.
      </p>
    </div>
  );
}
