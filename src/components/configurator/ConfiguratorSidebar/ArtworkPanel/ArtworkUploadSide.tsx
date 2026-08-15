/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, RefreshCw, Trash2, Upload } from "lucide-react";
import { clampDim, useArtworkPosition } from "@/lib/configurator/ArtworkPositionContext";
import { DEFAULT_ARTWORK_PRINT_AREA, PRINT_AREA_TOP_OFFSET_CM } from "@/lib/configurator/sizecharts";
import { persistUploadedBlob, persistUploadedFile, revokeObjectUrl } from "@/lib/configurator/objectUrls";
import type {
  ArtworkFileType,
  ArtworkSide,
} from "@/lib/configurator/types/configurator";
import { isCustomerArtworkTechnique } from "@/lib/configurator/types/configurator";
import { normalizeArtwork } from "@/lib/configurator/artworkProcessing/normalize";
import { artworkProcessingMessage } from "@/lib/configurator/artworkProcessing/errors";
import { ArtworkProcessingError, type ArtworkProcessingResult } from "@/lib/configurator/artworkProcessing/types";

export const ACCEPTED_ARTWORK_EXTENSIONS = [".png", ".jpg", ".jpeg", ".pdf", ".svg", ".ai"] as const;
export const MAX_ARTWORK_FILE_BYTES = 20 * 1024 * 1024;
export const SAMPLE_ARTWORK_HREF = "/garments/artwork-sample.svg";
export const SAMPLE_ARTWORK_DIMENSIONS = { width: 20, height: 3 } as const;
const PRINT_TEMPLATES_HREF = "/downloads/Garmops-print_templates-1.0.zip";
const DEFAULT_ARTWORK_WIDTH_CM = 20;
const FALLBACK_ARTWORK_HEIGHT_CM = 4.2;

function extensionToFileType(filename: string): ArtworkFileType | null {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "jpg";
  if (ext === ".png") return "png";
  if (ext === ".pdf") return "pdf";
  if (ext === ".svg") return "svg";
  if (ext === ".ai") return "ai";
  return null;
}

function expectedContentTypes(fileType: ArtworkFileType): string[] {
  switch (fileType) {
    case "jpg": return ["image/jpeg"];
    case "png": return ["image/png"];
    case "pdf": return ["application/pdf"];
    case "svg": return ["image/svg+xml"];
    case "ai": return ["application/postscript", "application/illustrator", "application/vnd.adobe.illustrator", "application/pdf", "application/octet-stream"];
  }
}

function isReliableMimeMismatch(file: File, fileType: ArtworkFileType): boolean {
  // Some browsers report an empty type for .ai files. The server validates the
  // extension/type pair again when the draft is moved to private R2 storage.
  return Boolean(file.type) && !expectedContentTypes(fileType).includes(file.type.toLowerCase());
}

function makeDefaultSide(
  fileUrl: string,
  fileType: ArtworkFileType,
  dimensions: { width: number; height: number },
  previous?: ArtworkSide,
  fileKey?: string,
  fileName?: string,
  processing?: ArtworkProcessingResult,
): ArtworkSide {
  return {
    fileUrl,
    fileKey,
    fileName,
    fileType,
    vectorized: processing?.vectorized ?? fileType === "svg",
    previewKind: processing?.previewKind,
    processingStatus: processing?.status ?? "ready",
    sourceIsVector: processing?.sourceIsVector ?? (fileType === "svg" ? true : undefined),
    backgroundRemoved: processing?.backgroundRemoved,
    backgroundRemovalConfidence: processing?.backgroundRemovalConfidence,
    detectedColorCount: processing?.detectedColorCount,
    isContinuousTone: processing?.isContinuousTone,
    processingWarnings: processing?.warnings,
    processingErrorCode: processing?.errorCode,
    technique: isCustomerArtworkTechnique(previous?.technique) ? previous.technique : undefined,
    reflectiveColour: previous?.reflectiveColour,
    placementPreset: "custom",
    width: dimensions.width,
    height: dimensions.height,
    fromNeck: PRINT_AREA_TOP_OFFSET_CM,
    fromCenter: 0,
    printArea: DEFAULT_ARTWORK_PRINT_AREA,
    guidelines: {
      maximumArea: true,
      leftChest: false,
    },
    confirmed: false,
    pixelWidth: processing?.pixelWidth,
    pixelHeight: processing?.pixelHeight,
    averageLuminance: processing?.averageLuminance,
    hasTransparency: processing?.hasTransparency,
  };
}

function getImageDimensions(fileUrl: string): Promise<{ naturalWidth: number; naturalHeight: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight });
    image.onerror = reject;
    image.src = fileUrl;
  });
}

async function getDefaultArtworkDimensions(fileUrl: string, fileType: ArtworkFileType) {
  if (fileUrl === SAMPLE_ARTWORK_HREF) return { ...SAMPLE_ARTWORK_DIMENSIONS };
  if (fileType === "ai" || fileType === "pdf") {
    return { width: DEFAULT_ARTWORK_WIDTH_CM, height: FALLBACK_ARTWORK_HEIGHT_CM };
  }

  try {
    const { naturalWidth, naturalHeight } = await getImageDimensions(fileUrl);
    if (naturalWidth > 0 && naturalHeight > 0) {
      return {
        width: DEFAULT_ARTWORK_WIDTH_CM,
        height: clampDim(DEFAULT_ARTWORK_WIDTH_CM * (naturalHeight / naturalWidth)),
      };
    }
  } catch {
    // The file summary remains usable even when a browser cannot render it.
  }
  return { width: DEFAULT_ARTWORK_WIDTH_CM, height: FALLBACK_ARTWORK_HEIGHT_CM };
}

export interface ArtworkUploadSideProps {
  side: "front" | "back";
  value?: ArtworkSide;
  onChange: (side: ArtworkSide | undefined) => void;
}

type UploadState = "preparing" | "uploaded" | null;

export function ArtworkUploadSide({ side, value, onChange }: ArtworkUploadSideProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingObjectUrlRef = useRef<string | null>(null);
  const pendingPreviewUrlRef = useRef<string | null>(null);
  const importTokenRef = useRef(0);
  const { updatePosition } = useArtworkPosition();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>(null);

  useEffect(() => () => {
    revokeObjectUrl(pendingObjectUrlRef.current ?? undefined);
    revokeObjectUrl(pendingPreviewUrlRef.current ?? undefined);
    pendingObjectUrlRef.current = null;
    pendingPreviewUrlRef.current = null;
  }, []);

  async function importArtwork(
    fileUrl: string,
    fileType: ArtworkFileType,
    token: number,
    sourceFile?: Blob,
    fileKey?: string,
    fileName?: string,
  ) {
    const dimensions = await getDefaultArtworkDimensions(fileUrl, fileType);
    const processing = sourceFile
      ? await normalizeArtwork(sourceFile, fileType)
      : {
          status: "ready" as const,
          originalFileType: fileType,
          previewKind: "vector" as const,
          vectorized: true,
          sourceIsVector: true,
        };
    if (token !== importTokenRef.current) {
      if (fileUrl !== SAMPLE_ARTWORK_HREF) revokeObjectUrl(fileUrl);
      return;
    }
    let previewUrl: string | undefined;
    let previewFileKey: string | undefined;
    if (processing.previewBlob) {
      previewUrl = URL.createObjectURL(processing.previewBlob);
      pendingPreviewUrlRef.current = previewUrl;
      previewFileKey = await persistUploadedBlob(
        processing.previewBlob,
        `${fileName?.replace(/\.[^.]+$/u, "") || "artwork"}.preview.${processing.previewKind === "vector" ? "svg" : "png"}`,
        processing.previewMimeType,
      );
    }
    if (token !== importTokenRef.current) {
      revokeObjectUrl(fileUrl);
      revokeObjectUrl(previewUrl);
      return;
    }
    if (pendingObjectUrlRef.current === fileUrl) pendingObjectUrlRef.current = null;
    if (pendingPreviewUrlRef.current === previewUrl) pendingPreviewUrlRef.current = null;
    updatePosition(side, { widthCm: dimensions.width, heightCm: dimensions.height, fromNeckCm: PRINT_AREA_TOP_OFFSET_CM, fromCenterCm: 0 });
    onChange({
      ...makeDefaultSide(fileUrl, fileType, dimensions, value, fileKey, fileName, processing),
      previewUrl,
      previewFileKey,
    });
    setUploadState("uploaded");
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const fileType = extensionToFileType(file.name);
    if (!fileType) {
      setError("Unsupported file type. Accepted: PNG, JPG / JPEG, PDF, SVG and AI.");
      return;
    }
    if (isReliableMimeMismatch(file, fileType)) {
      setError("This file's format does not match its extension. Export it again and try again.");
      return;
    }
    if (file.size > MAX_ARTWORK_FILE_BYTES) {
      setError("File is too large. Maximum size is 20 MB.");
      return;
    }

    setError(null);
    setPersistenceWarning(null);
    setUploadState("preparing");
    const fileUrl = URL.createObjectURL(file);
    revokeObjectUrl(pendingObjectUrlRef.current ?? undefined);
    if (value?.fileUrl !== fileUrl) revokeObjectUrl(value?.fileUrl);
    revokeObjectUrl(value?.previewUrl);
    revokeObjectUrl(pendingPreviewUrlRef.current ?? undefined);
    pendingObjectUrlRef.current = fileUrl;
    const token = importTokenRef.current + 1;
    importTokenRef.current = token;

    const persistedFile = persistUploadedFile(file);
    void persistedFile
      .then(async (fileKey) => {
        if (token !== importTokenRef.current) return;
        if (!fileKey) {
          setPersistenceWarning("This browser could not save the upload for reload recovery. Keep this tab open or try a different browser.");
        }
        await importArtwork(fileUrl, fileType, token, file, fileKey, file.name);
      })
      .catch((error: unknown) => {
        if (token !== importTokenRef.current) return;
        revokeObjectUrl(fileUrl);
        revokeObjectUrl(pendingPreviewUrlRef.current ?? undefined);
        if (pendingObjectUrlRef.current === fileUrl) pendingObjectUrlRef.current = null;
        pendingPreviewUrlRef.current = null;
        setUploadState(null);
        setError(
          error instanceof ArtworkProcessingError
            ? artworkProcessingMessage(error.code)
            : "This artwork could not be read. Export it again or upload another file.",
        );
      });
  }

  function handleRemove() {
    importTokenRef.current += 1;
    revokeObjectUrl(pendingObjectUrlRef.current ?? undefined);
    revokeObjectUrl(pendingPreviewUrlRef.current ?? undefined);
    revokeObjectUrl(value?.fileUrl);
    revokeObjectUrl(value?.previewUrl);
    pendingObjectUrlRef.current = null;
    pendingPreviewUrlRef.current = null;
    onChange(undefined);
    setError(null);
    setPersistenceWarning(null);
    setUploadState(null);
  }

  function handleTrySample() {
    importTokenRef.current += 1;
    revokeObjectUrl(pendingObjectUrlRef.current ?? undefined);
    revokeObjectUrl(pendingPreviewUrlRef.current ?? undefined);
    pendingObjectUrlRef.current = null;
    const token = importTokenRef.current;
    setError(null);
    setUploadState("preparing");
    void importArtwork(SAMPLE_ARTWORK_HREF, "svg", token).catch(() => {
      if (token !== importTokenRef.current) return;
      setUploadState(null);
      setError("The sample artwork could not be loaded. Upload your own file or try again.");
    });
  }

  const isPending = uploadState === "preparing";
  const filename = value?.fileName ?? value?.fileUrl?.split("/").pop() ?? "";
  const reviewNeeded = value?.processingStatus === "needs_review" || value?.processingStatus === "failed";

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_ARTWORK_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />

      {!value ? (
        <div
          data-dragging={dragging ? "true" : "false"}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); handleFiles(event.dataTransfer.files); }}
          className="techpack-dropzone relative flex flex-col items-center overflow-hidden rounded-sm px-4 py-5 text-center"
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="group relative z-10 flex min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-sm px-3 transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)"
          >
            <span className="techpack-control mb-1 flex h-10 w-10 items-center justify-center rounded-sm border text-(--color-accent-dark) transition-transform group-hover:-translate-y-0.5">
              {isPending ? <RefreshCw size={17} className="animate-spin" aria-hidden="true" /> : <Upload size={17} strokeWidth={2.2} aria-hidden="true" />}
            </span>
            <span className="text-sm font-medium text-(--text-primary)">Drag artwork here or browse</span>
            <span className="text-xs text-(--text-primary)/50">PNG · JPG / JPEG · PDF · SVG · AI · up to 20 MB</span>
          </button>
          <div className="relative z-10 mt-3 flex flex-wrap items-center justify-center gap-2">
            <a href={PRINT_TEMPLATES_HREF} download className="techpack-control inline-flex min-h-9 items-center gap-1.5 rounded-sm border px-3 text-xs font-medium text-(--text-primary)/80 transition-colors hover:!border-(--color-accent)/45 hover:text-(--color-accent-dark)">
              Download artwork template <Download size={13} strokeWidth={2.2} />
            </a>
            <button type="button" onClick={handleTrySample} className="techpack-control min-h-9 rounded-sm border !border-(--color-accent)/30 px-3 text-xs font-semibold text-(--color-accent-dark) transition-colors hover:!border-(--color-accent)/55 hover:!bg-white/55">
              Try sample artwork
            </button>
          </div>
        </div>
      ) : (
        <div className="techpack-subtle rounded-sm px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-(--color-rule) bg-white text-center text-[10px] font-semibold uppercase tracking-wide text-(--text-primary)/55">
              {(value.previewUrl || (value.fileType === "jpg" || value.fileType === "png" || value.fileType === "svg" ? value.fileUrl : undefined)) ? (
                <img src={value.previewUrl || value.fileUrl} alt="" className="h-full w-full object-contain p-1" />
              ) : (
                <span className="flex flex-col items-center gap-1">
                  <FileText size={17} strokeWidth={1.7} aria-hidden="true" />
                  <span>{value.fileType.toUpperCase()}</span>
                </span>
              )}
            </div>
            <div className="min-w-[9rem] flex-1">
              <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-(--text-primary)">
                <span className="truncate">{filename || "Artwork"}</span>
                {uploadState === "uploaded" && <span className="shrink-0 text-sm font-semibold text-[#1B7F36]" aria-label="Artwork uploaded">✓</span>}
              </p>
              <p className="mt-0.5 text-xs text-(--text-primary)/50">{value.fileType.toUpperCase()} · {value.processingStatus === "needs_review" ? "Preview needs review" : uploadState === "uploaded" ? "Artwork ready" : "Added"}</p>
            </div>
            <div className="ml-auto flex shrink-0 gap-1.5">
            <button type="button" onClick={() => inputRef.current?.click()} className="techpack-control inline-flex min-h-8 items-center gap-1 rounded-sm border px-2.5 text-xs font-semibold text-(--text-primary)/75 hover:!border-(--color-accent)/45 hover:text-(--color-accent-dark)">
              <RefreshCw size={13} aria-hidden="true" /> Replace
            </button>
            <button type="button" onClick={handleRemove} className="techpack-control inline-flex min-h-8 items-center gap-1 rounded-sm border px-2.5 text-xs font-semibold text-[#B53434] hover:!border-[#B53434]/40">
              <Trash2 size={13} aria-hidden="true" /> Remove
            </button>
            </div>
          </div>
        </div>
      )}

      {isPending && <p className="text-xs text-(--text-primary)/55" role="status" aria-live="polite">Preparing artwork…</p>}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      {persistenceWarning && <p className="rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">{persistenceWarning}</p>}
      {reviewNeeded && <p className="rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">Preview prepared. Our team will review this file before production.</p>}
      {value?.processingWarnings?.map((warning) => <p key={warning} className="text-xs leading-relaxed text-(--text-primary)/55">{warning}</p>)}
    </div>
  );
}
