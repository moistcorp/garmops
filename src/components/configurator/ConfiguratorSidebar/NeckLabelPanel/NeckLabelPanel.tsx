'use client';

import { JSX, useId, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, Download, Plus, Trash2, Upload } from 'lucide-react';
import { persistUploadedFile, revokeObjectUrl } from '@/lib/configurator/objectUrls';
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
  onClear?: () => void;
  isToteProduct?: boolean;
}

const DEFAULT_POSITION: NeckLabelPosition = 'below_neck_tape';
const ACCEPTED_FILE_TYPES = '.svg,.ai';
const DIMENSION_OPTIONS: NeckLabelDimensions[] = ['50x18', '60x20', '65x15', '45x45'];
const DEFAULT_DIMENSIONS: NeckLabelDimensions = '50x18';
const MAX_FILE_BYTES = 4.5 * 1024 * 1024;
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

export default function NeckLabelPanel({
  value,
  onChange,
  onClear,
  isToteProduct = false,
}: NeckLabelPanelProps): JSX.Element {
  const uploadInputId = useId();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const importTokenRef = useRef(0);
  const [fileUrl, setFileUrl] = useState<string | undefined>(value?.fileUrl);
  const [fileKey, setFileKey] = useState<string | undefined>(value?.fileKey);
  const [fileType, setFileType] = useState<NeckLabelFileType | undefined>(value?.fileType);
  const [fileName, setFileName] = useState<string | undefined>(value?.fileName);
  const [source, setSource] = useState<NeckLabel['source']>(value?.source);
  const [dimensions, setDimensions] = useState<NeckLabelDimensions | undefined>(value?.dimensions);
  const [position, setPosition] = useState<NeckLabelPosition>(value?.position ?? DEFAULT_POSITION);
  const [stitch, setStitch] = useState<NeckLabelStitch | undefined>(value?.stitch);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);

  function emit(next: {
    fileUrl?: string;
    fileKey?: string;
    fileName?: string;
    fileType?: NeckLabelFileType;
    source?: NeckLabel['source'];
    dimensions?: NeckLabelDimensions;
    position: NeckLabelPosition;
    stitch?: NeckLabelStitch;
  }) {
    if (!next.fileUrl || !next.dimensions) return;
    onChange?.({
      fileUrl: next.fileUrl,
      fileKey: next.fileKey,
      fileName: next.fileName,
      fileType: next.fileType,
      source: next.source,
      dimensions: next.dimensions,
      position: next.position,
      stitch: next.stitch,
      confirmed: false,
    });
  }

  function handleFileSelected(
    url: string,
    type?: NeckLabelFileType,
    nextSource: NeckLabel['source'] = 'upload',
    nextFileName?: string,
    nextFileKey?: string
  ) {
    const nextDimensions = dimensions ?? DEFAULT_DIMENSIONS;
    setFileUrl(url);
    setFileKey(nextFileKey);
    setFileType(type);
    setFileName(nextFileName);
    setSource(nextSource);
    setDimensions(nextDimensions);
    emit({
      fileUrl: url,
      fileKey: nextFileKey,
      fileName: nextFileName,
      fileType: type,
      source: nextSource,
      dimensions: nextDimensions,
      position,
      stitch,
    });
  }

  function handleSampleArtwork() {
    handleFileSelected(SAMPLE_ARTWORK_HREF, 'svg', 'sample');
  }

  function handleRemoveArtwork() {
    importTokenRef.current += 1;
    setFileUrl(undefined);
    setFileKey(undefined);
    setFileType(undefined);
    setFileName(undefined);
    setSource(undefined);
    setDimensions(undefined);
    setUploadError(null);
    setPersistenceWarning(null);
    if (uploadInputRef.current) uploadInputRef.current.value = '';
    onClear?.();
  }

  function handleDimensionsSelected(next: NeckLabelDimensions) {
    setDimensions(next);
    emit({ fileUrl, fileKey, fileName, fileType, source, dimensions: next, position, stitch });
  }

  function handlePositionChange(next: NeckLabelPosition) {
    const nextStitch = next === 'on_neck_tape' ? undefined : stitch;
    setPosition(next);
    setStitch(nextStitch);
    emit({ fileUrl, fileKey, fileName, fileType, source, dimensions, position: next, stitch: nextStitch });
  }

  function handleStitchChange(next: NeckLabelStitch) {
    setStitch(next);
    emit({ fileUrl, fileKey, fileName, fileType, source, dimensions, position, stitch: next });
  }

  const alreadyConfigured = value?.confirmed === true;

  return (
    <div className="flex flex-col gap-5">
      {alreadyConfigured && (
        <p className="rounded-lg bg-[#F7F7F7] px-3 py-2 text-xs font-medium text-[#111111]/60">
          {isToteProduct ? 'Bag label' : 'Neck label'} configured. Edit any option below to update.
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
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--color-teal)] px-4 text-xs font-bold text-[var(--color-teal)] hover:bg-[var(--color-teal)] hover:text-white"
        >
          Download Templates
          <Download size={15} strokeWidth={2.2} />
        </a>
      </div>

      <div className="group relative">
        <input
          ref={uploadInputRef}
          id={uploadInputId}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const nextFileType = fileTypeFromName(file.name);
            if (!nextFileType) {
              setUploadError('Unsupported file type. Upload an .svg or .ai file.');
              e.currentTarget.value = '';
              return;
            }
            if (file.size > MAX_FILE_BYTES) {
              setUploadError('File is too large. Maximum size is 4.5MB.');
              e.currentTarget.value = '';
              return;
            }
            setUploadError(null);
            setPersistenceWarning(null);
            const token = importTokenRef.current + 1;
            importTokenRef.current = token;
            const url = URL.createObjectURL(file);
            void persistUploadedFile(file).then((nextFileKey) => {
              if (token !== importTokenRef.current) {
                revokeObjectUrl(url);
                return;
              }
              if (!nextFileKey) {
                setPersistenceWarning(
                  'This browser could not save the upload for reload recovery. Keep this tab open or try a different browser.'
                );
              }
              handleFileSelected(
                url,
                nextFileType,
                'upload',
                file.name,
                nextFileKey
              );
            });
          }}
        />
        {fileUrl ? (
          <div className="flex min-h-[112px] items-center gap-4 rounded-2xl border border-[#D9D9D9] bg-white px-4 py-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#D9D9D9] bg-[#F7F7F7]">
              {source === 'sample' ? (
                <Image src={SAMPLE_ARTWORK_HREF} alt="" width={64} height={64} className="h-full w-full object-contain p-2" unoptimized />
              ) : (
                <span className="text-[10px] font-semibold uppercase text-[#111111]/45">
                  {fileType ?? 'file'}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <p className="truncate text-sm font-bold text-[#111111]">
                  {source === 'sample'
                    ? `NeckLabel-${(dimensions ?? DEFAULT_DIMENSIONS).replace('x', 'x')}.ai`
                    : fileName ?? `${isToteProduct ? 'BagLabel' : 'NeckLabel'}.${fileType ?? 'ai'}`}
                </p>
                <Check size={18} strokeWidth={2.4} className="shrink-0 text-[#16A34A]" />
              </div>
              <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-[#E5E5E5]">
                <div className="h-full w-full rounded-full bg-[#16A34A]" />
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveArtwork}
              aria-label={`Remove ${isToteProduct ? 'bag label' : 'neck label'} artwork`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#FF1F1F] transition-colors hover:bg-[#FFF1F1]"
            >
              <Trash2 size={21} strokeWidth={1.8} />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={handleSampleArtwork}
              className="absolute right-3 top-3 z-10 inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--color-navy)] px-3 text-xs font-bold text-white opacity-0 pointer-events-none transition-opacity duration-150 hover:bg-[var(--color-navy-soft)] group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
            >
              <Plus size={13} strokeWidth={2.4} />
              Try sample artwork
            </button>
            <label
              htmlFor={uploadInputId}
              className="flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-[#111111]/20 bg-white px-4 py-5 text-center hover:border-[var(--color-teal)]/40"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F7F7F7]">
                <Upload size={17} strokeWidth={2.1} />
              </span>
              <span className="text-xs font-bold text-[#111111]">
                Upload {isToteProduct ? 'bag label' : 'neck label'} artwork
              </span>
              <span className="text-xs text-[#111111]/55">
                Supports .svg and .ai files up to 4.5MB
              </span>
            </label>
          </>
        )}
      </div>

      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
      {persistenceWarning && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          {persistenceWarning}
        </p>
      )}

      <div>
        <div className="mb-2 text-xs font-bold text-[#111111]">Position</div>
        <PositionSelect value={position} onChange={handlePositionChange} isToteProduct={isToteProduct} />
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
