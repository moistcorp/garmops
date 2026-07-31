import type { NeckLabelPosition } from '@/lib/configurator/types/configurator';
import { JSX } from 'react/jsx-runtime';

export interface PositionSelectProps {
  value: NeckLabelPosition;
  onChange: (position: NeckLabelPosition) => void;
  isToteProduct?: boolean;
}

const GARMENT_POSITION_OPTIONS: { value: NeckLabelPosition; label: string }[] = [
  { value: 'below_neck_tape', label: 'Below neck tape (5 mm)' },
  { value: 'on_neck_tape', label: 'On neck tape' },
];

const TOTE_POSITION_OPTIONS: { value: NeckLabelPosition; label: string }[] = [
  { value: 'below_neck_tape', label: 'Inside top seam (5 mm)' },
  { value: 'on_neck_tape', label: 'On inner seam' },
];

export default function PositionSelect({
  value,
  onChange,
  isToteProduct = false,
}: PositionSelectProps): JSX.Element {
  const options = isToteProduct ? TOTE_POSITION_OPTIONS : GARMENT_POSITION_OPTIONS;
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={`min-h-12 rounded-[4px] border px-4 py-3 text-center font-sans text-[13px] font-semibold leading-tight tracking-normal transition-all ${
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
