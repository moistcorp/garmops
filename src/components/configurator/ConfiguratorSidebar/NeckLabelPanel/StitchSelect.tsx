import type { NeckLabelStitch } from '@/lib/configurator/types/configurator';
import { JSX } from 'react/jsx-runtime';

export interface StitchSelectProps {
  value?: NeckLabelStitch;
  onChange: (stitch: NeckLabelStitch) => void;
}

const STITCH_OPTIONS: { value: NeckLabelStitch; label: string }[] = [
  { value: '2_side', label: '2-side' },
  { value: '4_corner', label: '4-corner' },
  { value: '2_corner', label: '2-corner' },
];

export default function StitchSelect({ value, onChange }: StitchSelectProps): JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-2">
      {STITCH_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={`min-h-12 rounded-[4px] border px-3 py-2 text-center font-sans text-[13px] font-semibold leading-tight tracking-normal transition-all ${
              selected
                ? 'techpack-selected'
                : 'techpack-control border text-[#111111]/75 hover:!bg-white/60 hover:text-[#111111]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
