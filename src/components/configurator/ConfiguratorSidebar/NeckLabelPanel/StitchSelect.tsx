import type { NeckLabelStitch } from '@/lib/configurator/types/configurator';
import { JSX } from 'react/jsx-runtime';

export interface StitchSelectProps {
  value?: NeckLabelStitch;
  onChange: (stitch: NeckLabelStitch) => void;
  allowedStitches?: readonly NeckLabelStitch[];
}

const STITCH_OPTIONS: Array<{ value: NeckLabelStitch; label: string }> = [
  { value: '2_side', label: '2-side stitch' },
  { value: '4_corner', label: '4-corner stitch' },
  { value: '2_corner', label: '2-corner stitch' },
];

function StitchDiagram({ value, selected }: { value: NeckLabelStitch; selected: boolean }) {
  const line = selected ? 'border-white/85' : 'border-(--color-accent)/65';
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
  const visibleOptions = allowedStitches
    ? STITCH_OPTIONS.filter((option) => allowedStitches.includes(option.value))
    : STITCH_OPTIONS;

  return (
    <div className={`grid gap-2 ${visibleOptions.length === 1 ? 'grid-cols-1' : 'sm:grid-cols-3'}`}>
      {visibleOptions.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={`flex min-h-[112px] flex-col items-center rounded-sm border px-2 py-3 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent) ${selected ? 'techpack-selected' : 'techpack-control border text-(--text-primary)/75 hover:!bg-white/60'}`}
          >
            <StitchDiagram value={option.value} selected={selected} />
            <span className="mt-2 block text-xs font-semibold leading-tight">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
