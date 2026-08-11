/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, RefreshCw, Trash2, Upload } from "lucide-react";
import { clampDim, useArtworkPosition } from "@/lib/configurator/ArtworkPositionContext";
import { DEFAULT_ARTWORK_PRINT_AREA, PRINT_AREA_TOP_OFFSET_CM } from "@/lib/configurator/sizecharts";
import { persistUploadedFile, revokeObjectUrl } from "@/lib/configurator/objectUrls";
import type {
  ArtworkFileType,
  ArtworkSide,
} from "@/lib/configurator/types/configurator";
import { isCustomerArtworkTechnique } from "@/lib/configurator/types/configurator";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";

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
    case "ai": return ["application/postscript", "application/illustrator", "application/vnd.adobe.illustrator", "application/octet-stream"];
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
  diagnostics?: Pick<ArtworkSide, "pixelWidth" | "pixelHeight" | "hasTransparency" | "averageLuminance">,
): ArtworkSide {
  return {
    fileUrl,
    fileKey,
    fileName,
    fileType,
    vectorized: fileType === "svg" || fileType === "ai",
    technique: isCustomerArtworkTechnique(previous?.technique) ? previous.technique : undefined,
    placementPreset: "custom",
    width: dimensions.width,
    height: dimensions.height,
    fromNeck: PRINT_AREA_TOP_OFFSET_CM,
    fromCenter: 0,
    printArea: DEFAULT_ARTWORK_PRINT_AREA,
    guidelines: {
      ...previous?.guidelines,
      maximumArea: true,
      leftChest: previous?.guidelines?.leftChest ?? false,
    },
    confirmed: false,
    ...diagnostics,
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

async function analyseRasterArtwork(
  fileUrl: string,
): Promise<Pick<ArtworkSide, "pixelWidth" | "pixelHeight" | "hasTransparency" | "averageLuminance">> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = fileUrl;
  });
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 160 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { pixelWidth: image.naturalWidth, pixelHeight: image.naturalHeight };
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let transparent = false;
  let luminanceTotal = 0;
  let samples = 0;
  for (let index = 0; index < data.length; index += 16) {
    const alpha = data[index + 3] / 255;
    if (alpha < 0.98) transparent = true;
    if (alpha > 0.1) {
      luminanceTotal += (0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255;
      samples += 1;
    }
  }
  return {
    pixelWidth: image.naturalWidth,
    pixelHeight: image.naturalHeight,
    hasTransparency: transparent,
    averageLuminance: samples ? luminanceTotal / samples : undefined,
  };
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
  const importTokenRef = useRef(0);
  const { updatePosition } = useArtworkPosition();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>(null);

  useEffect(() => () => {
    revokeObjectUrl(pendingObjectUrlRef.current ?? undefined);
    pendingObjectUrlRef.current = null;
  }, []);

  async function importArtwork(
    fileUrl: string,
    fileType: ArtworkFileType,
    token: number,
    fileKey?: string,
    fileName?: string,
  ) {
    const dimensions = await getDefaultArtworkDimensions(fileUrl, fileType);
    const diagnostics = fileType === "jpg" || fileType === "png"
      ? await analyseRasterArtwork(fileUrl).catch(() => ({}))
      : {};
    if (token !== importTokenRef.current) {
      if (fileUrl !== SAMPLE_ARTWORK_HREF) revokeObjectUrl(fileUrl);
      return;
    }
    if (pendingObjectUrlRef.current === fileUrl) pendingObjectUrlRef.current = null;
    updatePosition(side, { widthCm: dimensions.width, heightCm: dimensions.height, fromNeckCm: PRINT_AREA_TOP_OFFSET_CM, fromCenterCm: 0 });
    onChange(makeDefaultSide(fileUrl, fileType, dimensions, value, fileKey, fileName, diagnostics));
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
    trackConfiguratorEvent("artwork_upload_started", { side, file_type: fileType, file_size: file.size });
    const fileUrl = URL.createObjectURL(file);
    revokeObjectUrl(pendingObjectUrlRef.current ?? undefined);
    if (value?.fileUrl !== fileUrl) revokeObjectUrl(value?.fileUrl);
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
        await importArtwork(fileUrl, fileType, token, fileKey, file.name);
        if (token === importTokenRef.current) trackConfiguratorEvent("artwork_upload_succeeded", { side, file_type: fileType });
      })
      .catch(() => {
        if (token !== importTokenRef.current) return;
        revokeObjectUrl(fileUrl);
        if (pendingObjectUrlRef.current === fileUrl) pendingObjectUrlRef.current = null;
        setUploadState(null);
        setError("This artwork could not be read. Export it again or upload another file.");
        trackConfiguratorEvent("artwork_upload_failed", { side, reason: "import_failed" });
      });
  }

  function handleRemove() {
    importTokenRef.current += 1;
    revokeObjectUrl(pendingObjectUrlRef.current ?? undefined);
    revokeObjectUrl(value?.fileUrl);
    pendingObjectUrlRef.current = null;
    onChange(undefined);
    setError(null);
    setPersistenceWarning(null);
    setUploadState(null);
  }

  function handleTrySample() {
    importTokenRef.current += 1;
    revokeObjectUrl(pendingObjectUrlRef.current ?? undefined);
    pendingObjectUrlRef.current = null;
    const token = importTokenRef.current;
    setError(null);
    setUploadState("preparing");
    void importArtwork(SAMPLE_ARTWORK_HREF, "svg", token).catch(() => {
      if (token !== importTokenRef.current) return;
      setUploadState(null);
      setError("The sample artwork could not be loaded. Upload your own file or try again.");
      trackConfiguratorEvent("artwork_upload_failed", { side, reason: "sample_import_failed" });
    });
  }

  const isPending = uploadState === "preparing";
  const filename = value?.fileName ?? value?.fileUrl?.split("/").pop() ?? "";
  const reviewNeeded = value && !value.vectorized;

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
          className="techpack-dropzone relative flex flex-col items-center overflow-hidden rounded-[4px] px-4 py-5 text-center"
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="group relative z-10 flex min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-[4px] px-3 transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            <span className="techpack-control mb-1 flex h-10 w-10 items-center justify-center rounded-[4px] border text-[var(--color-accent-dark)] transition-transform group-hover:-translate-y-0.5">
              {isPending ? <RefreshCw size={17} className="animate-spin" aria-hidden="true" /> : <Upload size={17} strokeWidth={2.2} aria-hidden="true" />}
            </span>
            <span className="text-sm font-medium text-[var(--text-primary)]">Drag artwork here or browse</span>
            <span className="text-xs text-[var(--text-primary)]/50">PNG · JPG / JPEG · PDF · SVG · AI · up to 20 MB</span>
          </button>
          <div className="relative z-10 mt-3 flex flex-wrap items-center justify-center gap-2">
            <a href={PRINT_TEMPLATES_HREF} download className="techpack-control inline-flex min-h-9 items-center gap-1.5 rounded-[4px] border px-3 text-xs font-medium text-[var(--text-primary)]/80 transition-colors hover:!border-[var(--color-accent)]/45 hover:text-[var(--color-accent-dark)]">
              Download artwork template <Download size={13} strokeWidth={2.2} />
            </a>
            <button type="button" onClick={handleTrySample} className="techpack-control min-h-9 rounded-[4px] border !border-[var(--color-accent)]/30 px-3 text-xs font-semibold text-[var(--color-accent-dark)] transition-colors hover:!border-[var(--color-accent)]/55 hover:!bg-white/55">
              Try sample artwork
            </button>
          </div>
        </div>
      ) : (
        <div className="techpack-subtle rounded-[4px] px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-[var(--color-rule)] bg-white text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--text-primary)]/55">
              {value.fileUrl && (value.fileType === "jpg" || value.fileType === "png" || value.fileType === "svg") ? (
                <img src={value.fileUrl} alt="" className="h-full w-full object-contain p-1" />
              ) : (
                <span className="flex flex-col items-center gap-1">
                  <FileText size={17} strokeWidth={1.7} aria-hidden="true" />
                  <span>{value.fileType.toUpperCase()}</span>
                </span>
              )}
            </div>
            <div className="min-w-[9rem] flex-1">
              <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-[var(--text-primary)]">
                <span className="truncate">{filename || "Artwork"}</span>
                {uploadState === "uploaded" && <span className="shrink-0 text-sm font-semibold text-[#1B7F36]" aria-label="Artwork uploaded">✓</span>}
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-primary)]/50">{value.fileType.toUpperCase()} · {uploadState === "uploaded" ? "Uploaded" : "Added"}</p>
            </div>
            <div className="ml-auto flex shrink-0 gap-1.5">
            <button type="button" onClick={() => inputRef.current?.click()} className="techpack-control inline-flex min-h-8 items-center gap-1 rounded-[4px] border px-2.5 text-xs font-semibold text-[var(--text-primary)]/75 hover:!border-[var(--color-accent)]/45 hover:text-[var(--color-accent-dark)]">
              <RefreshCw size={13} aria-hidden="true" /> Replace
            </button>
            <button type="button" onClick={handleRemove} className="techpack-control inline-flex min-h-8 items-center gap-1 rounded-[4px] border px-2.5 text-xs font-semibold text-[#B53434] hover:!border-[#B53434]/40">
              <Trash2 size={13} aria-hidden="true" /> Remove
            </button>
            </div>
          </div>
        </div>
      )}

      {isPending && <p className="text-xs text-[var(--text-primary)]/55" role="status" aria-live="polite">Preparing artwork…</p>}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      {persistenceWarning && <p className="rounded-[4px] border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">{persistenceWarning}</p>}
      {reviewNeeded && <p className="rounded-[4px] border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">This artwork may need production preparation. You can continue; our team will review it before production.</p>}
    </div>
  );
}
