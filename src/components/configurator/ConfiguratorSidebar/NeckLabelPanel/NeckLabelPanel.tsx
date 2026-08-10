'use client';

/* eslint-disable @next/next/no-img-element */
import { JSX, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, Download, Plus, Trash2, Upload } from 'lucide-react';
import { persistUploadedFile, revokeObjectUrl } from '@/lib/configurator/objectUrls';
import { AiPreviewError, renderAiPreview } from '@/lib/configurator/aiPreview';
import {
  NECK_LABEL_DIMENSIONS,
  createStandardNeckLabel,
  isCustomNeckLabel,
} from '@/lib/configurator/neckLabel';
import { formatInr, NECK_LABEL_UNIT_PRICE } from '@/lib/configurator/pricing';
import type {
  NeckLabel,
  NeckLabelDimensions,
  NeckLabelFileType,
  NeckLabelPosition,
  NeckLabelStitch,
  NeckLabelType,
} from '@/lib/configurator/types/configurator';
import PositionSelect from './PositionSelect';
import StitchSelect from './StitchSelect';

export interface NeckLabelPanelProps {
  value?: NeckLabel;
  onChange?: (neckLabel: NeckLabel) => void;
  onClear?: () => void;
  onPreviewChange?: (previewUrl?: string) => void;
  isToteProduct?: boolean;
}

const DEFAULT_POSITION: NeckLabelPosition = 'below_neck_tape';
const ACCEPTED_FILE_TYPES = '.svg,.ai';
const DEFAULT_DIMENSIONS: NeckLabelDimensions = '50x18';
const DEFAULT_STITCH: NeckLabelStitch = '2_corner';
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const TEMPLATE_HREF = '/downloads/neck-label-templates.zip';
const SAMPLE_ARTWORK_HREF = '/garments/neck-label-sample.svg';

type CustomDraft = {
  fileUrl: string;
  fileKey?: string;
  fileType?: NeckLabelFileType;
  fileName?: string;
  source?: NeckLabel['source'];
  dimensions: NeckLabelDimensions;
  position: NeckLabelPosition;
  stitch?: NeckLabelStitch;
};

function fileTypeFromName(name: string): NeckLabelFileType | undefined {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'svg') return 'svg';
  if (ext === 'ai') return 'ai';
  return undefined;
}

function fileFingerprint(value?: NeckLabel): string {
  return JSON.stringify([
    value?.labelType,
    value?.fileUrl,
    value?.fileKey,
    value?.fileType,
    value?.fileName,
    value?.source,
    value?.dimensions,
    value?.position,
    value?.stitch,
  ]);
}

function draftFromValue(value?: NeckLabel): CustomDraft {
  return {
    fileUrl: value?.fileUrl ?? '',
    fileKey: value?.fileKey,
    fileType: value?.fileType,
    fileName: value?.fileName,
    source: value?.source,
    dimensions: value?.dimensions ?? DEFAULT_DIMENSIONS,
    position: value?.position ?? DEFAULT_POSITION,
    stitch: value?.stitch ?? DEFAULT_STITCH,
  };
}

function formatDimensions(option: NeckLabelDimensions): string {
  return `${option.replace('x', ' × ')} mm`;
}

function DimensionPreview({
  option,
  selected,
}: {
  option: NeckLabelDimensions;
  selected: boolean;
}) {
  const [widthMm, heightMm] = option.split('x').map(Number);

  return (
    <span className="flex h-9 items-center justify-center" aria-hidden="true">
      <span
        className={`block rounded-[2px] border ${
          selected
            ? 'border-white/90 bg-white/30'
            : 'border-[var(--color-accent)]/45 bg-[var(--color-accent)]/14'
        }`}
        style={{
          width: `${Math.max(26, widthMm * 0.72)}px`,
          height: `${Math.max(10, heightMm * 0.62)}px`,
        }}
      />
    </span>
  );
}

function NeckLabelTypeCard({
  type,
  selected,
  title,
  detail,
  price,
  onClick,
}: {
  type: NeckLabelType;
  selected: boolean;
  title: string;
  detail: string;
  price?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-[122px] flex-1 flex-col items-start justify-between rounded-[4px] border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
        selected
          ? 'techpack-selected'
          : 'techpack-control border text-[var(--text-primary)]/75 hover:!bg-white/60'
      }`}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] opacity-65">
          {type === 'standard-size' ? 'Standard' : 'Custom'}
        </span>
        <span
          aria-hidden="true"
          className={`flex size-4 items-center justify-center rounded-full border ${
            selected ? 'border-white bg-white/90' : 'border-current/30'
          }`}
        >
          {selected && <span className="size-2 rounded-full bg-[var(--color-accent)]" />}
        </span>
      </span>
      <span>
        <span className="block text-sm font-semibold leading-tight tracking-normal">{title}</span>
        <span className="mt-1 block text-xs font-normal leading-relaxed tracking-normal opacity-70">
          {detail}
        </span>
        {price && (
          <span className="mt-2 block text-xs font-semibold leading-relaxed tracking-normal opacity-75">
            {price}
          </span>
        )}
      </span>
    </button>
  );
}

export default function NeckLabelPanel({
  value,
  onChange,
  onClear,
  onPreviewChange,
  isToteProduct = false,
}: NeckLabelPanelProps): JSX.Element {
  const uploadInputId = useId();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const importTokenRef = useRef(0);
  const emittedFingerprintRef = useRef<string | null>(null);
  const previewUrlRef = useRef<string | undefined>(undefined);
  const aiPreviewSourceRef = useRef<string | undefined>(undefined);
  const initialDraft = draftFromValue(isCustomNeckLabel(value) ? value : undefined);
  const customDraftRef = useRef<CustomDraft>(initialDraft);
  const initialType: NeckLabelType = isCustomNeckLabel(value) ? 'custom' : 'standard-size';
  const [labelType, setLabelType] = useState<NeckLabelType>(initialType);
  const [customDraft, setCustomDraft] = useState<CustomDraft>(() => initialDraft);
  const [aiPreviewUrl, setAiPreviewUrl] = useState<string | undefined>();
  const [aiPreviewState, setAiPreviewState] = useState<'idle' | 'preparing' | 'ready' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const labelNoun = isToteProduct ? 'bag label' : 'neck label';
  const standardTitle = isToteProduct ? 'Standard bag label' : 'Standard size label';
  const standardDetail = isToteProduct
    ? 'Bag label only · No custom branding'
    : 'Size label only · No custom branding';
  const customTitle = isToteProduct ? 'Custom bag label' : 'Custom neck label';

  const setPreviewUrl = useCallback((next?: string) => {
    if (previewUrlRef.current && previewUrlRef.current !== next) {
      revokeObjectUrl(previewUrlRef.current);
    }
    previewUrlRef.current = next;
    setAiPreviewUrl(next);
    onPreviewChange?.(next);
  }, [onPreviewChange]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) revokeObjectUrl(previewUrlRef.current);
      onPreviewChange?.(undefined);
    };
  }, [onPreviewChange]);

  useEffect(() => {
    const fingerprint = fileFingerprint(value);
    if (emittedFingerprintRef.current === fingerprint) {
      emittedFingerprintRef.current = null;
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const nextType: NeckLabelType = isCustomNeckLabel(value) ? 'custom' : 'standard-size';
      setLabelType(nextType);
      if (nextType === 'custom') {
        const nextDraft = draftFromValue(value);
        customDraftRef.current = nextDraft;
        setCustomDraft(nextDraft);
        if (value?.fileType !== 'ai') setPreviewUrl(value?.fileUrl || undefined);
      } else {
        setPreviewUrl(undefined);
        setAiPreviewState('idle');
      }
    });
    return () => { cancelled = true; };
  }, [
    value,
    value?.labelType,
    value?.fileUrl,
    value?.fileKey,
    value?.fileType,
    value?.fileName,
    value?.source,
    value?.dimensions,
    value?.position,
    value?.stitch,
    setPreviewUrl,
  ]);

  useEffect(() => {
    if (!value?.fileUrl || value.fileType !== 'ai' || !isCustomNeckLabel(value) || aiPreviewSourceRef.current === value.fileUrl) return;
    let cancelled = false;
    aiPreviewSourceRef.current = value.fileUrl;
    setAiPreviewState('preparing');
    void fetch(value.fileUrl)
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load Illustrator artwork');
        return response.blob();
      })
      .then((file) => renderAiPreview(file))
      .then((previewUrl) => {
        if (cancelled) {
          revokeObjectUrl(previewUrl);
          return;
        }
        setPreviewUrl(previewUrl);
        setAiPreviewState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAiPreviewState('error');
        setUploadError(
          error instanceof AiPreviewError && error.code === 'incompatible'
            ? 'This Illustrator file cannot be previewed. Re-save it from Illustrator with “Create PDF Compatible File” enabled, then upload it again.'
            : "We couldn't read this artwork file. Please export it again and retry."
        );
      });
    return () => {
      cancelled = true;
    };
  }, [value, value?.fileUrl, value?.fileType, value?.labelType, setPreviewUrl]);

  function emit(next: CustomDraft & { labelType: NeckLabelType; confirmed?: boolean }) {
    const output: NeckLabel = {
      labelType: next.labelType,
      fileUrl: next.fileUrl,
      fileKey: next.fileKey,
      fileType: next.fileType,
      fileName: next.fileName,
      source: next.source,
      dimensions: next.dimensions,
      position: next.position,
      stitch: next.stitch,
      confirmed: next.confirmed ?? false,
    };
    emittedFingerprintRef.current = fileFingerprint(output);
    onChange?.(output);
  }

  function updateCustomDraft(patch: Partial<CustomDraft>) {
    const next = { ...customDraftRef.current, ...patch };
    customDraftRef.current = next;
    setCustomDraft(next);
    emit({ ...next, labelType: 'custom' });
  }

  function chooseLabelType(nextType: NeckLabelType) {
    setUploadError(null);
    setLabelType(nextType);
    if (nextType === 'standard-size') {
      setPreviewUrl(undefined);
      setAiPreviewState('idle');
      emit({
        ...customDraftRef.current,
        ...createStandardNeckLabel(),
        labelType: 'standard-size',
      });
      return;
    }
    emit({ ...customDraftRef.current, labelType: 'custom' });
    if (customDraftRef.current.fileType === 'ai' && aiPreviewUrl) {
      onPreviewChange?.(aiPreviewUrl);
    } else if (customDraftRef.current.fileType === 'svg') {
      onPreviewChange?.(customDraftRef.current.fileUrl || undefined);
    }
  }

  function handleSampleArtwork() {
    const next: CustomDraft = {
      ...customDraftRef.current,
      fileUrl: SAMPLE_ARTWORK_HREF,
      fileType: 'svg',
      fileName: undefined,
      fileKey: undefined,
      source: 'sample',
    };
    customDraftRef.current = next;
    setCustomDraft(next);
    setPreviewUrl(SAMPLE_ARTWORK_HREF);
    setAiPreviewState('ready');
    emit({ ...next, labelType: 'custom' });
  }

  async function handleUploadFile(file?: File) {
    if (!file) return;
    const nextFileType = fileTypeFromName(file.name);
    const contentType = file.type.toLowerCase();
    const typeIsReliable = Boolean(contentType);
    const validMime =
      !typeIsReliable ||
      (nextFileType === 'svg' && contentType === 'image/svg+xml') ||
      (nextFileType === 'ai' &&
        ['application/postscript', 'application/illustrator', 'application/vnd.adobe.illustrator', 'application/octet-stream'].includes(contentType));
    if (!nextFileType || !validMime) {
      setUploadError('Upload an SVG or AI file.');
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError('This file is larger than 20 MB. Upload a smaller SVG or AI file.');
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      return;
    }

    setUploadError(null);
    setPersistenceWarning(null);
    const token = importTokenRef.current + 1;
    importTokenRef.current = token;
    const url = URL.createObjectURL(file);
    setLabelType('custom');
    const nextDraft: CustomDraft = {
      ...customDraftRef.current,
      fileUrl: url,
      fileType: nextFileType,
      fileName: file.name,
      source: 'upload',
    };
    customDraftRef.current = nextDraft;
    setCustomDraft(nextDraft);
    if (nextFileType === 'ai') {
      setPreviewUrl(undefined);
      setAiPreviewState('preparing');
    } else {
      setPreviewUrl(url);
      setAiPreviewState('ready');
    }
    // Mark Custom immediately so the live preview and canonical price reflect
    // the customer's choice while the original is being persisted/rendered.
    emit({ ...nextDraft, labelType: 'custom' });

    const previewPromise = nextFileType === 'ai' ? renderAiPreview(file) : Promise.resolve(undefined);
    const [nextFileKey, previewResult] = await Promise.allSettled([
      persistUploadedFile(file),
      previewPromise,
    ]);
    if (token !== importTokenRef.current) {
      revokeObjectUrl(url);
      if (previewResult.status === 'fulfilled' && previewResult.value) revokeObjectUrl(previewResult.value);
      return;
    }
    const persistedKey = nextFileKey.status === 'fulfilled' ? nextFileKey.value : undefined;
    if (!persistedKey) {
      setPersistenceWarning(
        'This browser could not save the upload for reload recovery. Keep this tab open or try a different browser.'
      );
    }
    const finalDraft = { ...nextDraft, fileKey: persistedKey };
    customDraftRef.current = finalDraft;
    setCustomDraft(finalDraft);
    emit({ ...finalDraft, labelType: 'custom' });
    if (nextFileType === 'ai') {
      if (previewResult.status === 'fulfilled' && previewResult.value) {
        aiPreviewSourceRef.current = url;
        setPreviewUrl(previewResult.value);
        setAiPreviewState('ready');
      } else {
        setAiPreviewState('error');
        const previewError = previewResult.status === 'rejected' ? previewResult.reason : undefined;
        setUploadError(
          previewError instanceof AiPreviewError && previewError.code === 'incompatible'
            ? 'This Illustrator file cannot be previewed. Re-save it from Illustrator with “Create PDF Compatible File” enabled, then upload it again.'
            : "We couldn't read this artwork file. Please export it again and retry."
        );
      }
    }
  }

  function handleRemoveArtwork() {
    importTokenRef.current += 1;
    const next: CustomDraft = {
      fileUrl: '',
      dimensions: customDraftRef.current.dimensions,
      position: customDraftRef.current.position,
      stitch: customDraftRef.current.stitch ?? DEFAULT_STITCH,
    };
    customDraftRef.current = next;
    setCustomDraft(next);
    setPreviewUrl(undefined);
    setAiPreviewState('idle');
    setUploadError(null);
    setPersistenceWarning(null);
    if (uploadInputRef.current) uploadInputRef.current.value = '';
    emit({ ...next, labelType: 'custom' });
    onClear?.();
  }

  function handleDimensionsSelected(next: NeckLabelDimensions) {
    updateCustomDraft({ dimensions: next });
  }

  function handlePositionChange(next: NeckLabelPosition) {
    updateCustomDraft({
      position: next,
      stitch: next === 'on_neck_tape' ? undefined : customDraftRef.current.stitch ?? DEFAULT_STITCH,
    });
  }

  function handleStitchChange(next: NeckLabelStitch) {
    updateCustomDraft({ stitch: next });
  }

  const selectedCustom = labelType === 'custom';
  const hasArtwork = Boolean(customDraft.fileUrl || customDraft.fileKey);
  const previewReady = customDraft.fileType !== 'ai'
    ? hasArtwork
    : aiPreviewState === 'ready' && Boolean(aiPreviewUrl);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
          Choose your {labelNoun}
        </h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[var(--text-primary)]/60">
          Keep the standard size label, or add your own branded {labelNoun}.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Label type">
        <NeckLabelTypeCard
          type="standard-size"
          selected={!selectedCustom}
          title={standardTitle}
          detail={standardDetail}
          onClick={() => chooseLabelType('standard-size')}
        />
        <NeckLabelTypeCard
          type="custom"
          selected={selectedCustom}
          title={customTitle}
          detail={`Add your own branded ${labelNoun} artwork.`}
          price={`Additional cost · ${formatInr(NECK_LABEL_UNIT_PRICE)} / piece`}
          onClick={() => chooseLabelType('custom')}
        />
      </div>

      {!selectedCustom ? (
        <div className="techpack-subtle rounded-[4px] border border-[var(--color-accent)]/15 px-4 py-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{standardTitle} selected</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-primary)]/60">{standardDetail}</p>
          <p className="mt-3 text-xs leading-relaxed text-[var(--text-primary)]/55">
            {isToteProduct
              ? 'This product keeps its standard bag-label treatment.'
              : 'Each garment receives the standard size label for its allocated size.'}
          </p>
        </div>
      ) : (
        <>
          <section>
            <SectionHeading>1 — Upload label artwork</SectionHeading>
            <div className="relative">
              <input
                ref={uploadInputRef}
                id={uploadInputId}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                className="sr-only"
                onChange={(event) => void handleUploadFile(event.target.files?.[0])}
              />
              {hasArtwork ? (
                <div className="techpack-subtle flex min-h-[104px] items-center gap-3 rounded-[4px] p-3">
                  <div className="techpack-control flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border bg-white">
                    {customDraft.source === 'sample' || customDraft.fileType === 'svg' ? (
                      <img
                        src={customDraft.source === 'sample' ? SAMPLE_ARTWORK_HREF : customDraft.fileUrl}
                        alt="Uploaded label artwork preview"
                        className="h-full w-full object-contain p-2"
                      />
                    ) : aiPreviewUrl ? (
                      <img src={aiPreviewUrl} alt="Rendered Illustrator label artwork preview" className="h-full w-full object-contain p-2" />
                    ) : (
                      <span className="px-1 text-center text-xs font-medium leading-relaxed text-[var(--text-primary)]/50">
                        Preview unavailable
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold leading-tight text-[var(--text-primary)]/85">
                      {customDraft.source === 'sample' ? `Garmops sample · ${formatDimensions(customDraft.dimensions)}` : customDraft.fileName ?? `${labelNoun}.${customDraft.fileType ?? 'ai'}`}
                    </p>
                    <span className="mt-1.5 flex items-center gap-1 text-xs font-medium leading-relaxed text-[#2E7D32]">
                      {aiPreviewState === 'preparing' ? 'Preparing preview…' : previewReady ? <><Check size={13} strokeWidth={2.5} aria-hidden="true" /> Preview ready</> : 'Artwork uploaded'}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <label
                      htmlFor={uploadInputId}
                      className="techpack-control inline-flex min-h-9 cursor-pointer items-center rounded-[4px] border px-2.5 text-xs font-semibold text-[var(--text-primary)]/75 hover:!border-[var(--color-accent)]/45 hover:text-[var(--color-accent-dark)]"
                    >
                      Replace
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveArtwork}
                      className="techpack-control inline-flex min-h-9 items-center rounded-[4px] border px-2.5 text-xs font-semibold text-[#C62828] hover:!border-[#C62828]/25 hover:!bg-[#FFF1F1]/70"
                    >
                      <Trash2 size={14} className="mr-1" aria-hidden="true" /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  data-dragging={dragging ? 'true' : 'false'}
                  onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => { event.preventDefault(); setDragging(false); void handleUploadFile(event.dataTransfer.files?.[0]); }}
                  className="techpack-dropzone relative flex flex-col items-center overflow-hidden rounded-[4px] px-4 py-5 text-center transition-colors"
                >
                  <label
                    htmlFor={uploadInputId}
                    className="group relative z-10 flex min-h-24 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[4px] px-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-accent)]"
                  >
                    <span className="techpack-control mb-1 flex h-10 w-10 items-center justify-center rounded-[4px] border text-[var(--color-accent-dark)]">
                      <Upload size={17} strokeWidth={2.2} aria-hidden="true" />
                    </span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">Drag artwork here or browse</span>
                    <span className="text-xs text-[var(--text-primary)]/50">SVG · AI · Up to 20 MB</span>
                  </label>
                  <div className="relative z-10 mt-3 flex flex-wrap items-center justify-center gap-2">
                    <a href={TEMPLATE_HREF} download className="techpack-control inline-flex min-h-9 items-center gap-1.5 rounded-[4px] border px-3 text-xs font-medium text-[var(--text-primary)]/80 hover:!border-[var(--color-accent)]/45 hover:text-[var(--color-accent-dark)]">
                      Download label template <Download size={13} strokeWidth={2.2} />
                    </a>
                    <button type="button" onClick={handleSampleArtwork} className="techpack-control min-h-9 rounded-[4px] border !border-[var(--color-accent)]/30 px-3 text-xs font-semibold text-[var(--color-accent-dark)] hover:!border-[var(--color-accent)]/55 hover:!bg-white/55">
                      <Plus size={13} strokeWidth={2.4} className="mr-1 inline" /> Try sample label
                    </button>
                  </div>
                </div>
              )}
            </div>
            {uploadError && <p className="mt-2 text-xs leading-relaxed text-red-600">{uploadError}</p>}
            {persistenceWarning && <p className="mt-2 rounded-[4px] border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">{persistenceWarning}</p>}
          </section>

          <section>
            <SectionHeading>2 — Choose label size</SectionHeading>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {NECK_LABEL_DIMENSIONS.map((option) => {
                const selected = customDraft.dimensions === option;
                const description = option === '50x18' ? 'Standard horizontal' : option === '60x20' ? 'Wide horizontal' : option === '65x15' ? 'Slim horizontal' : 'Square';
                return (
                  <button key={option} type="button" onClick={() => handleDimensionsSelected(option)} aria-pressed={selected} className={`flex min-h-[98px] flex-col items-center justify-center gap-1 rounded-[4px] border p-2 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${selected ? 'techpack-selected' : 'techpack-control border text-[var(--text-primary)]/70 hover:!bg-white/60'}`}>
                    <DimensionPreview option={option} selected={selected} />
                    <span className="text-xs font-semibold leading-tight">{formatDimensions(option)}</span>
                    <span className="text-xs font-normal leading-relaxed opacity-65">{description}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-primary)]/45">Preview shown approximately to scale.</p>
          </section>

          <section>
            <SectionHeading>3 — Choose placement</SectionHeading>
            <PositionSelect value={customDraft.position} onChange={handlePositionChange} isToteProduct={isToteProduct} />
          </section>

          {customDraft.position === 'below_neck_tape' && (
            <section>
              <SectionHeading>4 — Choose stitching</SectionHeading>
              <StitchSelect value={customDraft.stitch} onChange={handleStitchChange} />
            </section>
          )}

          <div className="techpack-subtle rounded-[4px] px-4 py-3 text-xs leading-relaxed text-[var(--text-primary)]/65">
            {hasArtwork ? 'Artwork uploaded. Check the live preview, then continue when the label details look right.' : 'Upload your artwork to see it in the live preview.'}
          </div>
        </>
      )}
    </div>
  );
}

function SectionHeading({ children }: { children: string }) {
  return <h2 className="mb-2.5 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-primary)]/70">{children}</h2>;
}
