import type { NeckLabelStitch } from '@/lib/configurator/types/configurator';
import { useId } from 'react';
import { JSX } from 'react/jsx-runtime';

export interface StitchSelectProps {
  value?: NeckLabelStitch;
  onChange: (stitch: NeckLabelStitch) => void;
  allowedStitches?: readonly NeckLabelStitch[];
}

const STITCH_OPTIONS: Array<{ value: NeckLabelStitch; label: string; detail: string }> = [
  { value: '2_side', label: '2-side stitch', detail: 'Clean side finish' },
  { value: '4_corner', label: '4-corner stitch', detail: 'Most secure' },
  { value: '2_corner', label: '2-corner stitch', detail: 'Minimal attachment' },
];

function StitchDiagram({ value, selected }: { value: NeckLabelStitch; selected: boolean }) {
  const line = selected ? 'border-(--color-accent)' : 'border-(--color-accent)/65';
  return (
    <span className="relative block h-12 w-16 border border-current/20 bg-white/20" aria-hidden="true">
      {value === '2_side' ? (
        <>
          <span className={`absolute inset-y-1 left-1 border-l-2 border-dashed ${line}`} />
          <span className={`absolute inset-y-1 right-1 border-r-2 border-dashed ${line}`} />
        </>
      ) : (
        <>
          <span className={`absolute left-0.5 right-0.5 top-1 border-t-2 border-dashed ${line}`} />
          {value === '4_corner' && <span className={`absolute bottom-1 left-0.5 right-0.5 border-t-2 border-dashed ${line}`} />}
          {value === '2_corner' && <span className={`absolute left-1 top-1 h-2 w-2 rounded-full border-2 ${line}`} />}
          {value === '2_corner' && <span className={`absolute right-1 top-1 h-2 w-2 rounded-full border-2 ${line}`} />}
        </>
      )}
    </span>
  );
}

export default function StitchSelect({ value, onChange, allowedStitches }: StitchSelectProps): JSX.Element {
  const groupName = useId();
  const visibleOptions = allowedStitches
    ? STITCH_OPTIONS.filter((option) => allowedStitches.includes(option.value))
    : STITCH_OPTIONS;

  return (
    <fieldset className={`grid gap-2 ${visibleOptions.length === 1 ? 'grid-cols-1' : 'sm:grid-cols-3'}`}>
      <legend className="sr-only">Choose label stitching</legend>
      {visibleOptions.map((option) => {
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            className={`relative flex min-h-[112px] cursor-pointer flex-col items-center rounded-sm border px-2 py-3 text-center transition-[background-color,border-color,transform] duration-150 active:scale-[.985] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--color-accent) ${selected ? 'border-(--color-accent) bg-[#EEF3FF] text-(--text-primary) ring-1 ring-(--color-accent)/10' : 'techpack-control text-(--text-primary)/75 hover:!border-(--color-accent)/45 hover:!bg-white/60'}`}
          >
            <input type="radio" name={groupName} value={option.value} checked={selected} onChange={() => onChange(option.value)} className="absolute inset-0 z-10 cursor-pointer opacity-0" />
            <StitchDiagram value={option.value} selected={selected} />
            <span className="mt-2 block text-xs font-semibold leading-tight">{option.label}</span>
            <span className="mt-1 block text-[10px] leading-tight text-(--text-primary)/50">{option.detail}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
