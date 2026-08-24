import type { NeckLabelPosition } from '@/lib/configurator/types/configurator';
import { useId } from 'react';
import { JSX } from 'react/jsx-runtime';

export interface PositionSelectProps {
  value: NeckLabelPosition;
  onChange: (position: NeckLabelPosition) => void;
  isToteProduct?: boolean;
}

const GARMENT_POSITION_OPTIONS: Array<{
  value: NeckLabelPosition;
  label: string;
  detail?: string;
}> = [
  { value: 'below_neck_tape', label: 'Below neck tape', detail: 'Most common · hangs below the tape' },
  { value: 'on_neck_tape', label: 'On neck tape', detail: 'Minimal finish · sewn onto the tape' },
];

const TOTE_POSITION_OPTIONS: Array<{
  value: NeckLabelPosition;
  label: string;
  detail: string;
}> = [
  { value: 'below_neck_tape', label: 'Inside top seam', detail: '2 cm below the top seam' },
];

function PlacementDiagram({ value, selected }: { value: NeckLabelPosition; selected: boolean }) {
  const onTape = value === 'on_neck_tape';
  return (
    <span className="relative block h-12 w-full max-w-[128px]" aria-hidden="true">
      <span className="absolute left-1/2 top-1 w-16 -translate-x-1/2 border-t-2 border-(--text-primary)/50" />
      <span className="absolute left-1/2 top-4 h-2 w-20 -translate-x-1/2 border border-dashed border-(--text-primary)/35 bg-(--text-primary)/5" />
      <span className={`absolute left-1/2 ${onTape ? 'top-[15px]' : 'top-[27px]'} flex h-5 w-12 -translate-x-1/2 items-center justify-center border ${selected ? 'border-(--color-accent) bg-(--color-accent)/18' : 'border-(--color-accent)/55 bg-(--color-accent)/12'}`}>
        <span className="h-px w-7 border-t border-dashed border-current/60" />
      </span>
      {!onTape && <span className="absolute left-1/2 top-6 h-3 -translate-x-1/2 border-l border-dashed border-(--color-accent)/55" />}
    </span>
  );
}

export default function PositionSelect({ value, onChange, isToteProduct = false }: PositionSelectProps): JSX.Element {
  const options = isToteProduct ? TOTE_POSITION_OPTIONS : GARMENT_POSITION_OPTIONS;
  const groupName = useId();
  return (
    <fieldset className={`grid gap-2 ${isToteProduct ? 'sm:grid-cols-1' : 'sm:grid-cols-2'}`}>
      <legend className="sr-only">Choose label placement</legend>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            className={`relative flex min-h-[106px] cursor-pointer flex-col items-center justify-center rounded-sm border px-3 py-2 text-center transition-[background-color,border-color,transform] duration-150 active:scale-[.985] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--color-accent) ${selected ? 'border-(--color-accent) bg-[#EEF3FF] text-(--text-primary) ring-1 ring-(--color-accent)/10' : 'techpack-control text-(--text-primary)/75 hover:!border-(--color-accent)/45 hover:!bg-white/60'}`}
          >
            <input type="radio" name={groupName} value={option.value} checked={selected} onChange={() => onChange(option.value)} className="absolute inset-0 z-10 cursor-pointer opacity-0" />
            <PlacementDiagram value={option.value} selected={selected} />
            <span className="mt-1 block text-xs font-semibold leading-tight">{option.label}</span>
            {option.detail && <span className="mt-1 block text-xs font-normal leading-relaxed opacity-65">{option.detail}</span>}
          </label>
        );
      })}
    </fieldset>
  );
}
