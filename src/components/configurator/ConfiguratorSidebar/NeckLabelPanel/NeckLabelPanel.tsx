'use client';

import Image from 'next/image';
import { JSX, type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, CheckCircle2, ChevronDown, Download, LockKeyhole, Plus, Trash2, Upload } from 'lucide-react';
import { persistUploadedFile, revokeObjectUrl } from '@/lib/configurator/objectUrls';
import { AiPreviewError, renderAiPreview } from '@/lib/configurator/aiPreview';
import {
  NECK_LABEL_DIMENSIONS,
  NECK_LABEL_POSITION_LABELS,
  NECK_LABEL_STITCH_LABELS,
  createStandardNeckLabel,
  isCustomNeckLabel,
  neckLabelStitchesForPosition,
  normalizeNeckLabelStitch,
} from '@/lib/configurator/neckLabel';
import { formatInr, getVolumeDiscountPercent, NECK_LABEL_UNIT_PRICE } from '@/lib/configurator/pricing';
import type { ProductId } from '@/lib/configurator/pricing';
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
import { garmentAssetUrl } from '@/lib/publicAssets';
import CanvasRenderer from '@/components/configurator/GarmentPreview/CanvasRenderer';

export interface NeckLabelPanelProps {
  value?: NeckLabel;
  onChange?: (neckLabel: NeckLabel) => void;
  onClear?: () => void;
  onPreviewChange?: (previewUrl?: string) => void;
  isToteProduct?: boolean;
  productId?: ProductId;
  colourHex?: string;
  quantity?: number;
}

const DEFAULT_POSITION: NeckLabelPosition = 'below_neck_tape';
const ACCEPTED_FILE_TYPES = '.svg,.ai';
const DEFAULT_DIMENSIONS: NeckLabelDimensions = '50x18';
const DEFAULT_STITCH: NeckLabelStitch = '2_corner';
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const TEMPLATE_HREF = '/downloads/neck-label-templates.zip';
const SAMPLE_ARTWORK_HREF = garmentAssetUrl('neck-label-sample.svg');

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

type SetupSection = 'size' | 'placement' | 'stitching';

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

function draftFromValue(value?: NeckLabel, isToteProduct = false): CustomDraft {
  const position = isToteProduct ? DEFAULT_POSITION : value?.position ?? DEFAULT_POSITION;
  return {
    fileUrl: value?.fileUrl ?? '',
    fileKey: value?.fileKey,
    fileType: value?.fileType,
    fileName: value?.fileName,
    source: value?.source,
    dimensions: value?.dimensions ?? DEFAULT_DIMENSIONS,
    position,
    stitch: normalizeNeckLabelStitch(position, value?.stitch),
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
        className={`block rounded-xs border ${selected ? 'border-(--color-accent) bg-(--color-accent)/18' : 'border-(--color-accent)/35 bg-(--color-accent)/10'}`}
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
  badge,
  name,
  onSelect,
}: {
  type: NeckLabelType;
  selected: boolean;
  title: string;
  detail: string;
  price?: string;
  badge: string;
  name: string;
  onSelect: () => void;
}) {
  return (
    <label className={`relative flex min-h-[92px] flex-1 cursor-pointer flex-col items-start justify-start rounded-sm border p-3.5 text-left transition-[background-color,border-color,color,transform] duration-150 active:scale-[.985] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--color-accent) sm:min-h-[116px] sm:p-4 ${selected ? 'border-(--color-accent) bg-[#EEF3FF] text-(--text-primary) ring-1 ring-(--color-accent)/10' : 'techpack-control text-(--text-primary)/75 hover:!border-(--color-accent)/45 hover:!bg-white/60'}`}>
      <input
        type="radio"
        name={name}
        value={type}
        checked={selected}
        onChange={onSelect}
        className="absolute inset-0 z-10 cursor-pointer opacity-0"
      />
      <span className="flex w-full items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] opacity-65">
          {badge}
        </span>
        <span
          aria-hidden="true"
          className={`flex size-4 items-center justify-center rounded-full border ${
            selected ? 'border-(--color-accent) bg-white' : 'border-current/30'
          }`}
        >
          {selected && <span className="size-2 rounded-full bg-(--color-accent)" />}
        </span>
      </span>
      <span className="mt-3 block">
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
    </label>
  );
}

export default function NeckLabelPanel({
  value,
  onChange,
  onClear,
  onPreviewChange,
  isToteProduct = false,
  productId,
  colourHex,
  quantity = 50,
}: NeckLabelPanelProps): JSX.Element {
  const uploadInputId = useId();
  const labelTypeGroupName = useId();
  const dimensionGroupName = useId();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const importTokenRef = useRef(0);
  const emittedFingerprintRef = useRef<string | null>(null);
  const previewUrlRef = useRef<string | undefined>(undefined);
  const aiPreviewSourceRef = useRef<string | undefined>(undefined);
  const initialDraft = draftFromValue(isCustomNeckLabel(value) ? value : undefined, isToteProduct);
  const customDraftRef = useRef<CustomDraft>(initialDraft);
  const initialType: NeckLabelType = isCustomNeckLabel(value) ? 'custom' : 'standard-size';
  const [labelType, setLabelType] = useState<NeckLabelType>(initialType);
  const [customDraft, setCustomDraft] = useState<CustomDraft>(() => initialDraft);
  const [aiPreviewUrl, setAiPreviewUrl] = useState<string | undefined>();
  const [aiPreviewState, setAiPreviewState] = useState<'idle' | 'preparing' | 'ready' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [activeSetupSection, setActiveSetupSection] = useState<SetupSection | null>(
    initialDraft.fileUrl || initialDraft.fileKey ? 'size' : null,
  );
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  const labelNoun = isToteProduct ? 'bag label' : 'neck label';
  const standardTitle = 'Standard size label';
  const standardDetail = 'Size and care information only';
  const customTitle = isToteProduct ? 'Custom bag label' : 'Custom neck label';

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const sync = () => setShowMobilePreview(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

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
        const nextDraft = draftFromValue(value, isToteProduct);
        customDraftRef.current = nextDraft;
        setCustomDraft(nextDraft);
        setActiveSetupSection(nextDraft.fileUrl || nextDraft.fileKey ? 'size' : null);
        if (value?.fileType !== 'ai') setPreviewUrl(value?.fileUrl || undefined);
      } else {
        if (isToteProduct) {
          const emptyDraft = draftFromValue(undefined, true);
          customDraftRef.current = emptyDraft;
          setCustomDraft(emptyDraft);
        }
        setPreviewUrl(undefined);
        setAiPreviewState('idle');
        setActiveSetupSection(null);
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
    isToteProduct,
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
      setActiveSetupSection(null);
      setPreviewUrl(undefined);
      setAiPreviewState('idle');
      emit({
        ...customDraftRef.current,
        ...createStandardNeckLabel(),
        labelType: 'standard-size',
      });
      return;
    }
    setActiveSetupSection(customDraftRef.current.fileUrl || customDraftRef.current.fileKey ? 'size' : null);
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
    setActiveSetupSection('size');
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
    setActiveSetupSection('size');
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
    setActiveSetupSection(null);
    if (uploadInputRef.current) uploadInputRef.current.value = '';
    emit({ ...next, labelType: 'custom' });
    onClear?.();
  }

  function handleDimensionsSelected(next: NeckLabelDimensions) {
    updateCustomDraft({ dimensions: next });
    setActiveSetupSection('placement');
  }

  function handlePositionChange(next: NeckLabelPosition) {
    updateCustomDraft({
      position: next,
      stitch: normalizeNeckLabelStitch(next, customDraftRef.current.stitch),
    });
    setActiveSetupSection('stitching');
  }

  function handleStitchChange(next: NeckLabelStitch) {
    updateCustomDraft({ stitch: next });
    setActiveSetupSection(null);
  }

  // Tote bags have no included/standard label choice. Keep the upload form
  // available without emitting a custom selection until the customer acts.
  const selectedCustom = isToteProduct || labelType === 'custom';
  const hasArtwork = Boolean(customDraft.fileUrl || customDraft.fileKey);
  const previewReady = customDraft.fileType !== 'ai'
    ? hasArtwork
    : aiPreviewState === 'ready' && Boolean(aiPreviewUrl);
  const safeQuantity = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 50;
  const discountPercent = getVolumeDiscountPercent(safeQuantity);
  const labelOrderDelta = NECK_LABEL_UNIT_PRICE * safeQuantity * (1 - discountPercent / 100);
  const normalizedStitch = normalizeNeckLabelStitch(customDraft.position, customDraft.stitch);
  const previewLabel: NeckLabel = selectedCustom
    ? {
        ...customDraft,
        labelType: 'custom',
        fileUrl: customDraft.fileUrl,
        stitch: normalizedStitch,
        confirmed: false,
      }
    : createStandardNeckLabel();
  const previewImageSource = customDraft.fileType === 'ai'
    ? aiPreviewUrl
    : customDraft.fileUrl || undefined;

  return (
    <div className="flex flex-col gap-4 pb-1">
      <div>
        <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-(--color-accent)">
          04 · Label details
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-(--text-primary)">
          Choose your {labelNoun}
        </h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-(--text-primary)/60">
          {isToteProduct
            ? 'Add a custom branded bag label inside the top seam.'
            : `Keep the standard size label, or add your own branded ${labelNoun}.`}
        </p>
      </div>

      {showMobilePreview && productId && colourHex ? (
        <section className="sticky top-0 z-20 -mx-1 rounded-sm border border-(--color-control-border) bg-white p-2 shadow-sm lg:hidden" aria-label="Live neck label preview">
          <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
            <span className="text-xs font-semibold text-(--text-primary)">Back neck · Live preview</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-(--text-primary)/50">
              {selectedCustom ? formatDimensions(customDraft.dimensions) : 'Included label'}
            </span>
          </div>
          <div className="h-32 overflow-hidden rounded-sm bg-(--color-studio-bg)">
            <CanvasRenderer
              view="neck"
              colourHex={colourHex}
              productId={productId}
              artwork={{}}
              neckLabel={previewLabel}
              neckLabelPreviewUrl={previewImageSource}
              interactive={false}
              showProductionGuides={false}
              className="h-full w-full scale-[1.35] rounded-sm"
            />
          </div>
        </section>
      ) : null}

      {isToteProduct ? (
        <div className="techpack-subtle rounded-sm border px-4 py-3" aria-label="Custom bag label only">
          <p className="text-sm font-semibold text-(--text-primary)">{customTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-(--text-primary)/60">
            Custom artwork required · +{formatInr(NECK_LABEL_UNIT_PRICE)}/unit once added
          </p>
        </div>
      ) : (
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">Choose label type</legend>
          <NeckLabelTypeCard
            type="standard-size"
            selected={!selectedCustom}
            title={standardTitle}
            detail={standardDetail}
            badge="Standard · Included"
            name={labelTypeGroupName}
            onSelect={() => chooseLabelType('standard-size')}
          />
          <NeckLabelTypeCard
            type="custom"
            selected={selectedCustom}
            title={customTitle}
            detail="Best for branded apparel"
            price={`+${formatInr(NECK_LABEL_UNIT_PRICE)}/unit · approx. ${formatInr(labelOrderDelta)} for ${safeQuantity}`}
            badge="Custom"
            name={labelTypeGroupName}
            onSelect={() => chooseLabelType('custom')}
          />
        </fieldset>
      )}

      {!selectedCustom ? (
        <div className="rounded-sm border border-(--color-accent)/22 bg-[#F6F8FF] p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0 text-(--color-accent)" size={18} aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-(--text-primary)">Standard label ready</p>
              <p className="mt-1 text-xs leading-relaxed text-(--text-primary)/60">
                Included size tab · Below neck tape. No artwork upload is required.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <WorkflowProgress hasArtwork={hasArtwork} activeSection={activeSetupSection} />

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
                <div className="techpack-subtle flex min-h-[104px] items-center gap-3 rounded-sm p-3">
                  <div className="neck-label-preview-grid relative size-14 shrink-0 overflow-hidden rounded-sm border border-(--color-control-border) bg-white">
                    {previewReady && previewImageSource ? (
                      <Image
                        src={previewImageSource}
                        alt=""
                        fill
                        unoptimized
                        sizes="56px"
                        className="object-contain p-1.5"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center font-mono text-[9px] uppercase tracking-wide text-(--text-primary)/40">
                        {aiPreviewState === 'preparing' ? 'Preparing' : 'Artwork'}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold leading-tight text-(--text-primary)/85">
                      {customDraft.source === 'sample' ? `Garmops sample · ${formatDimensions(customDraft.dimensions)}` : customDraft.fileName ?? `${labelNoun}.${customDraft.fileType ?? 'ai'}`}
                    </p>
                    <span className="mt-1.5 flex items-center gap-1 text-xs font-medium leading-relaxed text-[#2E7D32]">
                      {aiPreviewState === 'preparing' ? 'Preparing preview…' : previewReady ? <><Check size={13} strokeWidth={2.5} aria-hidden="true" /> Preview ready</> : 'Artwork uploaded'}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:flex-row">
                    <label
                      htmlFor={uploadInputId}
                      className="techpack-control inline-flex min-h-9 cursor-pointer items-center rounded-sm border px-2.5 text-xs font-semibold text-(--text-primary)/75 hover:!border-(--color-accent)/45 hover:text-(--color-accent-dark)"
                    >
                      Replace
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveArtwork}
                      className="techpack-control inline-flex min-h-9 items-center rounded-sm border px-2.5 text-xs font-semibold text-[#C62828] hover:!border-[#C62828]/25 hover:!bg-[#FFF1F1]/70"
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
                  className="techpack-dropzone relative flex flex-col items-center overflow-hidden rounded-sm px-4 py-5 text-center transition-colors"
                >
                  <label
                    htmlFor={uploadInputId}
                    className="group relative z-10 flex min-h-24 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-sm px-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-(--color-accent)"
                  >
                    <span className="techpack-control mb-1 flex h-10 w-10 items-center justify-center rounded-sm border text-(--color-accent-dark)">
                      <Upload size={17} strokeWidth={2.2} aria-hidden="true" />
                    </span>
                    <span className="text-sm font-medium text-(--text-primary)">Drag artwork here or browse</span>
                    <span className="text-xs text-(--text-primary)/50">SVG or PDF-compatible AI · Up to 20 MB</span>
                  </label>
                  <div className="relative z-10 mt-3 flex flex-wrap items-center justify-center gap-2">
                    <a href={TEMPLATE_HREF} download className="techpack-control inline-flex min-h-9 items-center gap-1.5 rounded-sm border px-3 text-xs font-medium text-(--text-primary)/80 hover:!border-(--color-accent)/45 hover:text-(--color-accent-dark)">
                      Download label template <Download size={13} strokeWidth={2.2} />
                    </a>
                    <button type="button" onClick={handleSampleArtwork} className="techpack-control min-h-9 rounded-sm border !border-(--color-accent)/30 px-3 text-xs font-semibold text-(--color-accent-dark) hover:!border-(--color-accent)/55 hover:!bg-white/55">
                      <Plus size={13} strokeWidth={2.4} className="mr-1 inline" /> Try sample label
                    </button>
                  </div>
                </div>
              )}
            </div>
            {uploadError && <p className="mt-2 text-xs leading-relaxed text-red-600">{uploadError}</p>}
            {persistenceWarning && <p className="mt-2 rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">{persistenceWarning}</p>}
          </section>

          {hasArtwork ? (
            <div className="space-y-2">
              <SetupSectionCard
                number="2"
                title="Label size"
                summary={formatDimensions(customDraft.dimensions)}
                open={activeSetupSection === 'size'}
                onToggle={() => setActiveSetupSection((current) => current === 'size' ? null : 'size')}
              >
                <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <legend className="sr-only">Choose label size</legend>
                  {NECK_LABEL_DIMENSIONS.map((option) => {
                    const selected = customDraft.dimensions === option;
                    const recommended = option === DEFAULT_DIMENSIONS;
                    return (
                      <label key={option} className={`relative flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border p-2 text-center transition-[background-color,border-color,transform] duration-150 active:scale-[.985] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--color-accent) ${selected ? 'border-(--color-accent) bg-[#EEF3FF] text-(--text-primary) ring-1 ring-(--color-accent)/10' : 'techpack-control text-(--text-primary)/70 hover:!border-(--color-accent)/45 hover:!bg-white/60'}`}>
                        <input type="radio" name={dimensionGroupName} value={option} checked={selected} onChange={() => handleDimensionsSelected(option)} className="absolute inset-0 z-10 cursor-pointer opacity-0" />
                        <DimensionPreview option={option} selected={selected} />
                        <span className="text-xs font-semibold leading-tight">{formatDimensions(option)}</span>
                        <span className="text-[10px] leading-tight text-(--text-primary)/48">{recommended ? 'Recommended for tees' : option === '45x45' ? 'Square format' : 'Wide format'}</span>
                      </label>
                    );
                  })}
                </fieldset>
              </SetupSectionCard>

              <SetupSectionCard
                number="3"
                title="Placement"
                summary={(isToteProduct ? 'Inside top seam' : NECK_LABEL_POSITION_LABELS[customDraft.position])}
                open={activeSetupSection === 'placement'}
                onToggle={() => setActiveSetupSection((current) => current === 'placement' ? null : 'placement')}
              >
                <PositionSelect value={customDraft.position} onChange={handlePositionChange} isToteProduct={isToteProduct} />
              </SetupSectionCard>

              <SetupSectionCard
                number="4"
                title="Stitching"
                summary={NECK_LABEL_STITCH_LABELS[normalizedStitch]}
                open={activeSetupSection === 'stitching'}
                onToggle={() => setActiveSetupSection((current) => current === 'stitching' ? null : 'stitching')}
              >
                <StitchSelect
                  value={normalizedStitch}
                  onChange={handleStitchChange}
                  allowedStitches={neckLabelStitchesForPosition(customDraft.position)}
                />
              </SetupSectionCard>

              <div className="rounded-sm border border-(--color-accent)/22 bg-[#F6F8FF] px-3.5 py-3" aria-live="polite">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-(--color-accent)" size={17} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-(--text-primary)">Custom label ready</p>
                    <p className="mt-1 text-xs leading-relaxed text-(--text-primary)/60">
                      {formatDimensions(customDraft.dimensions)} · {isToteProduct ? 'Inside top seam' : NECK_LABEL_POSITION_LABELS[customDraft.position]} · {NECK_LABEL_STITCH_LABELS[normalizedStitch]}
                    </p>
                    <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-(--color-accent)">
                      +{formatInr(NECK_LABEL_UNIT_PRICE)}/unit · approx. {formatInr(labelOrderDelta)} for {safeQuantity}
                      {discountPercent > 0 ? ` after ${discountPercent}% volume discount` : ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-sm border border-dashed border-(--color-control-border) px-3 py-2.5 text-xs text-(--text-primary)/52">
              <LockKeyhole size={14} aria-hidden="true" /> Upload artwork to choose size, placement and stitching.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SectionHeading({ children }: { children: string }) {
  return <h2 className="mb-2.5 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-(--text-primary)/70">{children}</h2>;
}

function SetupSectionCard({
  number,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  number: string;
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-sm border border-(--color-control-border) bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-3 px-3 text-left transition-colors duration-150 hover:bg-(--color-cream-soft)/55"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-(--color-accent)/10 font-mono text-[10px] font-semibold text-(--color-accent)">{number}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-(--text-primary)">{title}</span>
          <span className="mt-0.5 block truncate text-[11px] text-(--text-primary)/52">{summary}</span>
        </span>
        <ChevronDown size={15} className={`shrink-0 text-(--text-primary)/45 transition-transform duration-150 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open ? <div className="border-t border-(--color-control-border) p-3">{children}</div> : null}
    </section>
  );
}

function WorkflowProgress({
  hasArtwork,
  activeSection,
}: {
  hasArtwork: boolean;
  activeSection: SetupSection | null;
}) {
  const steps: Array<{ id: 'artwork' | SetupSection; label: string }> = [
    { id: 'artwork', label: 'Artwork' },
    { id: 'size', label: 'Size' },
    { id: 'placement', label: 'Placement' },
    { id: 'stitching', label: 'Stitching' },
  ];
  const activeIndex = activeSection ? steps.findIndex((step) => step.id === activeSection) : hasArtwork ? steps.length : 0;

  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Custom label setup progress">
      {steps.map((step, index) => {
        const complete = hasArtwork && index < activeIndex;
        const active = index === activeIndex;
        const locked = !hasArtwork && index > 0;
        return (
          <li key={step.id} className="min-w-0">
            <span className={`mb-1.5 block h-0.5 rounded-full ${complete || active ? 'bg-(--color-accent)' : 'bg-(--color-control-border)'}`} />
            <span className={`flex items-center gap-1 truncate font-mono text-[9px] font-semibold uppercase tracking-[0.05em] ${complete || active ? 'text-(--color-accent)' : 'text-(--text-primary)/38'}`}>
              {complete ? <Check size={10} strokeWidth={2.8} aria-hidden="true" /> : locked ? <LockKeyhole size={9} aria-hidden="true" /> : null}
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
