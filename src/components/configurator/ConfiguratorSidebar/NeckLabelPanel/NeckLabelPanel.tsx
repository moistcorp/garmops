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
const DEFAULT_STITCH: NeckLabelStitch = '2_corner';
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
  const [dimensions, setDimensions] = useState<NeckLabelDimensions>(
    value?.dimensions ?? DEFAULT_DIMENSIONS
  );
  const [position, setPosition] = useState<NeckLabelPosition>(value?.position ?? DEFAULT_POSITION);
  const [stitch, setStitch] = useState<NeckLabelStitch | undefined>(
    value?.stitch ?? DEFAULT_STITCH
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

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
    if (!next.dimensions) return;
    onChange?.({
      fileUrl: next.fileUrl ?? '',
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

  function handleUploadFile(file?: File) {
    if (!file) return;
    const nextFileType = fileTypeFromName(file.name);
    if (!nextFileType) {
      setUploadError('Unsupported file type. Upload an .svg or .ai file.');
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError('File is too large. Maximum size is 4.5MB.');
      if (uploadInputRef.current) uploadInputRef.current.value = '';
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
  }

  function handleRemoveArtwork() {
    importTokenRef.current += 1;
    setFileUrl(undefined);
    setFileKey(undefined);
    setFileType(undefined);
    setFileName(undefined);
    setSource(undefined);
    setDimensions(DEFAULT_DIMENSIONS);
    setPosition(DEFAULT_POSITION);
    setStitch(DEFAULT_STITCH);
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
    const nextStitch =
      next === 'on_neck_tape' ? undefined : stitch ?? DEFAULT_STITCH;
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
        <p className="configurator-glass-subtle rounded-xl px-3 py-2 text-xs font-medium text-[#111111]/60">
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
                className={`flex min-h-[78px] flex-col items-center justify-center gap-2 rounded-xl border text-xs font-semibold transition-all ${
                  selected
                    ? 'configurator-glass-selected'
                    : 'configurator-glass-control border text-[#111111]/55 hover:!bg-white/60 hover:text-[#111111]'
                }`}
              >
                <DimensionPreview option={option} />
                {option.replace('x', '×')}mm
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <input
          ref={uploadInputRef}
          id={uploadInputId}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          className="sr-only"
          onChange={(e) => {
            handleUploadFile(e.target.files?.[0]);
          }}
        />
        {fileUrl ? (
          <div className="configurator-glass-subtle flex min-h-[112px] items-center gap-4 rounded-2xl px-4 py-4">
            <div className="configurator-glass-control flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border">
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
              className="configurator-glass-control flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[#C62828] transition-colors hover:!border-[#C62828]/25 hover:!bg-[#FFF1F1]/70"
            >
              <Trash2 size={21} strokeWidth={1.8} />
            </button>
          </div>
        ) : (
          <div
            data-dragging={dragging ? 'true' : 'false'}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              handleUploadFile(event.dataTransfer.files?.[0]);
            }}
            className="configurator-glass-dropzone relative flex flex-col items-center overflow-hidden rounded-[22px] px-4 py-5 text-center transition-all duration-200"
          >
            <label
              htmlFor={uploadInputId}
              className="group relative z-10 flex min-h-24 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl px-3 transition-colors hover:bg-white/20 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-teal)]"
            >
              <span className="configurator-glass-control mb-1 flex h-10 w-10 items-center justify-center rounded-full border text-[var(--color-teal-dark)] transition-transform group-hover:-translate-y-0.5">
                <Upload size={17} strokeWidth={2.2} aria-hidden="true" />
              </span>
              <span className="text-sm font-medium text-[#111111]">
                Drag and drop {isToteProduct ? 'bag label' : 'neck label'} artwork, or click to browse
              </span>
              <span className="text-xs text-[#111111]/50">
                Supports .svg and .ai files up to 4.5MB
              </span>
            </label>
            <div className="relative z-10 mt-3 flex flex-wrap items-center justify-center gap-2">
              <a
                href={TEMPLATE_HREF}
                download
                className="configurator-glass-control inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium uppercase tracking-wide text-[#111111]/80 transition-colors hover:!border-[var(--color-teal)]/45 hover:text-[var(--color-teal-dark)]"
              >
                Download Templates
                <Download size={13} strokeWidth={2.2} />
              </a>
              <button
                type="button"
                onClick={handleSampleArtwork}
                className="configurator-glass-control min-h-9 rounded-full border !border-[var(--color-teal)]/30 px-3 text-xs font-semibold text-[var(--color-teal-dark)] transition-colors hover:!border-[var(--color-teal)]/55 hover:!bg-white/55"
              >
                <Plus size={13} strokeWidth={2.4} className="mr-1 inline" />
                Try sample artwork
              </button>
            </div>
          </div>
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
