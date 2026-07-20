'use client';

import { JSX, useId, useState } from 'react';
import { Download, Plus, Upload } from 'lucide-react';
import type {
  NeckLabel,
  NeckLabelDimensions,
  NeckLabelFileType,
  NeckLabelPosition,
  NeckLabelStitch,
} from '@/lib/configurator/types/configurator';
import PositionSelect from './PositionSelect';
import StitchSelect from './StitchSelect';

export interface NeckLabelPanelProps {
  value?: NeckLabel;
  onChange?: (neckLabel: NeckLabel) => void;
}

const DEFAULT_POSITION: NeckLabelPosition = 'below_neck_tape';
const ACCEPTED_FILE_TYPES = '.svg,.ai';
const DIMENSION_OPTIONS: NeckLabelDimensions[] = ['50x18', '60x20', '65x15', '45x45'];
const TEMPLATE_HREF = '/downloads/neck-label-templates.zip';
// A real, renderable sample (the template zip is .ai-only and can't be
// rasterized in a browser preview) — used by "Try sample artwork" so the
// live preview has something to actually show.
const SAMPLE_ARTWORK_HREF = '/garments/neck-label-sample.svg';

function fileTypeFromName(name: string): NeckLabelFileType | undefined {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'svg') return 'svg';
  if (ext === 'ai') return 'ai';
  return undefined;
}

function DimensionPreview({ option }: { option: NeckLabelDimensions }) {
  const isSquare = option === '45x45';
  return (
    <span className="flex h-8 items-center justify-center" aria-hidden="true">
      <span
        className={`block border border-[#111111]/70 bg-white ${
          isSquare ? 'h-7 w-7' : 'h-3 w-12'
        }`}
      >
        <span className="block h-full w-full border-t border-dashed border-[#111111]/30" />
      </span>
    </span>
  );
}

export default function NeckLabelPanel({ value, onChange }: NeckLabelPanelProps): JSX.Element {
  const uploadInputId = useId();
  const [fileUrl, setFileUrl] = useState<string | undefined>(value?.fileUrl);
  const [fileType, setFileType] = useState<NeckLabelFileType | undefined>(value?.fileType);
  const [dimensions, setDimensions] = useState<NeckLabelDimensions | undefined>(value?.dimensions);
  const [position, setPosition] = useState<NeckLabelPosition>(value?.position ?? DEFAULT_POSITION);
  const [stitch, setStitch] = useState<NeckLabelStitch | undefined>(value?.stitch);

  function emit(next: {
    fileUrl?: string;
    fileType?: NeckLabelFileType;
    dimensions?: NeckLabelDimensions;
    position: NeckLabelPosition;
    stitch?: NeckLabelStitch;
  }) {
    if (!next.fileUrl || !next.dimensions) return;
    onChange?.({
      fileUrl: next.fileUrl,
      fileType: next.fileType,
      dimensions: next.dimensions,
      position: next.position,
      stitch: next.stitch,
      confirmed: false,
    });
  }

  function handleFileSelected(url: string, type?: NeckLabelFileType) {
    setFileUrl(url);
    setFileType(type);
    emit({ fileUrl: url, fileType: type, dimensions, position, stitch });
  }

  function handleSampleArtwork() {
    handleFileSelected(SAMPLE_ARTWORK_HREF, 'svg');
  }

  function handleDimensionsSelected(next: NeckLabelDimensions) {
    setDimensions(next);
    emit({ fileUrl, fileType, dimensions: next, position, stitch });
  }

  function handlePositionChange(next: NeckLabelPosition) {
    const nextStitch = next === 'on_neck_tape' ? undefined : stitch;
    setPosition(next);
    setStitch(nextStitch);
    emit({ fileUrl, fileType, dimensions, position: next, stitch: nextStitch });
  }

  function handleStitchChange(next: NeckLabelStitch) {
    setStitch(next);
    emit({ fileUrl, fileType, dimensions, position, stitch: next });
  }

  const alreadyConfigured = value?.confirmed === true;

  return (
    <div className="flex flex-col gap-5">
      {alreadyConfigured && (
        <p className="rounded-lg bg-[#F7F7F7] px-3 py-2 text-xs font-medium text-[#111111]/60">
          Neck label configured. Edit any option below to update.
        </p>
      )}

      <div>
        <div className="mb-2 text-xs font-bold text-[#111111]">Dimensions</div>
        <div className="grid grid-cols-4 gap-2">
          {DIMENSION_OPTIONS.map((option) => {
            const selected = dimensions === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => handleDimensionsSelected(option)}
                aria-pressed={selected}
                className={`flex min-h-[78px] flex-col items-center justify-center gap-2 rounded-md text-xs font-semibold transition-colors ${
                  selected
                    ? 'bg-white shadow-[inset_0_0_0_1.5px_#111111]'
                    : 'bg-[#F7F7F7] text-[#111111]/55 hover:text-[#111111]'
                }`}
              >
                <DimensionPreview option={option} />
                {option.replace('x', '×')}mm
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-y border-[#E5E5E5] py-4">
        <p className="max-w-[210px] text-xs font-medium leading-relaxed text-[#111111]/55">
          We recommend artwork using our .ai template.
        </p>
        <a
          href={TEMPLATE_HREF}
          download
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[#111111] px-4 text-xs font-bold text-[#111111] hover:bg-[#111111] hover:text-white"
        >
          Download Templates
          <Download size={15} strokeWidth={2.2} />
        </a>
      </div>

      <div className="group relative">
        <input
          id={uploadInputId}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const url = URL.createObjectURL(file);
            handleFileSelected(url, fileTypeFromName(file.name));
          }}
        />
        <button
          type="button"
          onClick={handleSampleArtwork}
          className="absolute right-3 top-3 z-10 inline-flex h-8 items-center gap-1.5 rounded-full bg-[#333333] px-3 text-xs font-bold text-white opacity-0 pointer-events-none transition-opacity duration-150 hover:bg-[#111111] group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
        >
          <Plus size={13} strokeWidth={2.4} />
          Try sample artwork
        </button>
        <label
          htmlFor={uploadInputId}
          className="flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-[#111111]/20 bg-white px-4 py-5 text-center hover:border-[#111111]/40"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F7F7F7]">
            <Upload size={17} strokeWidth={2.1} />
          </span>
          <span className="text-xs font-bold text-[#111111]">
            {fileUrl ? 'Artwork selected' : 'Upload neck label artwork'}
          </span>
          <span className="text-xs text-[#111111]/55">
            Supports .svg and .ai files up to 4.5MB
          </span>
        </label>
      </div>

      <div>
        <div className="mb-2 text-xs font-bold text-[#111111]">Position</div>
        <PositionSelect value={position} onChange={handlePositionChange} />
      </div>

      {position === 'below_neck_tape' && (
        <div>
          <div className="mb-2 text-xs font-bold text-[#111111]">Stitch</div>
          <StitchSelect value={stitch} onChange={handleStitchChange} />
        </div>
      )}
    </div>
  );
}
