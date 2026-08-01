"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Upload, X } from "lucide-react";
import {
  clampDim,
  useArtworkPosition,
} from "@/lib/configurator/ArtworkPositionContext";
import {
  persistUploadedFile,
  revokeObjectUrl,
} from "@/lib/configurator/objectUrls";
import type {
  ArtworkFileType,
  ArtworkSide,
  ArtworkTechnique,
} from "@/lib/configurator/types/configurator";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";

const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".svg", ".ai"];
const MAX_FILE_BYTES = 4.5 * 1024 * 1024;
export const SAMPLE_ARTWORK_HREF = "/garments/artwork-sample.svg";
export const SAMPLE_ARTWORK_DIMENSIONS = { width: 20, height: 3 } as const;
const PRINT_TEMPLATES_HREF = "/downloads/Garmops-print_templates-1.0.zip";
const VECTORIZER_HREF = "https://vectorizer.ai/";
const DEFAULT_ARTWORK_WIDTH_CM = 20;
const FALLBACK_VECTOR_HEIGHT_CM = 4.2;

const VECTOR_REQUIRED_TECHNIQUES: ArtworkTechnique[] = [
  "screen_print",
  "puff_print",
  "embroidery",
  "reflective_heat_transfer",
];

function extensionToFileType(filename: string): ArtworkFileType | null {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "jpg";
  if (ext === ".png") return "png";
  if (ext === ".svg") return "svg";
  if (ext === ".ai") return "ai";
  return null;
}

// Dimension + placement fields (width/height/fromNeck/fromCenter/printArea/
// guidelines) belong to a later positioning phase. Placeholder defaults are
// used here so the ArtworkSide shape stays whole without redefining the type.
function makeDefaultSide(
  fileUrl: string,
  fileType: ArtworkFileType,
  dimensions: { width: number; height: number },
  technique?: ArtworkTechnique,
  fileKey?: string,
  fileName?: string,
  diagnostics?: Pick<ArtworkSide, "pixelWidth" | "pixelHeight" | "hasTransparency" | "averageLuminance">
): ArtworkSide {
  return {
    fileUrl,
    fileKey,
    fileName,
    fileType,
    vectorized: fileType === "svg" || fileType === "ai",
    technique,
    width: dimensions.width,
    height: dimensions.height,
    fromNeck: 5,
    fromCenter: 0,
    printArea: "XS",
    guidelines: { maximumArea: true, leftChest: false },
    confirmed: false,
    ...diagnostics,
  };
}

function getImageDimensions(fileUrl: string): Promise<{ naturalWidth: number; naturalHeight: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({ naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight });
    image.onerror = reject;
    image.src = fileUrl;
  });
}

async function getDefaultArtworkDimensions(
  fileUrl: string,
  fileType: ArtworkFileType
): Promise<{ width: number; height: number }> {
  if (fileUrl === SAMPLE_ARTWORK_HREF) {
    return { ...SAMPLE_ARTWORK_DIMENSIONS };
  }

  if (fileType === "ai") {
    return { width: DEFAULT_ARTWORK_WIDTH_CM, height: FALLBACK_VECTOR_HEIGHT_CM };
  }

  try {
    const { naturalWidth, naturalHeight } = await getImageDimensions(fileUrl);
    if (naturalWidth > 0 && naturalHeight > 0) {
      const ratio = naturalHeight / naturalWidth;
      return {
        width: DEFAULT_ARTWORK_WIDTH_CM,
        height: clampDim(DEFAULT_ARTWORK_WIDTH_CM * ratio),
      };
    }
  } catch {
    // Fall through to a logo-strip default for malformed/blocked preview assets.
  }

  return { width: DEFAULT_ARTWORK_WIDTH_CM, height: FALLBACK_VECTOR_HEIGHT_CM };
}


async function analyseRasterArtwork(fileUrl: string): Promise<Pick<ArtworkSide, "pixelWidth" | "pixelHeight" | "hasTransparency" | "averageLuminance">> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = fileUrl;
  });
  const canvas = document.createElement("canvas");
  const maxSide = 160;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
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

interface VectorConversionDialogProps {
  onClose: () => void;
  onOpenConverter: () => void;
  onUploadToStudio: () => void;
}

function VectorConversionDialog({
  onClose,
  onOpenConverter,
  onUploadToStudio,
}: VectorConversionDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((element) => !element.hasAttribute("hidden"));
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/20 p-4 "
      role="dialog"
      aria-modal="true"
      aria-labelledby="vector-conversion-title"
      aria-describedby="vector-conversion-description"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} className="techpack-surface relative w-full max-w-[720px] rounded-[4px] border p-6 sm:p-8">
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close convert artwork guide"
          className="absolute right-[-14px] top-[-14px] flex h-9 w-9 items-center justify-center rounded-[4px] bg-[var(--color-navy)] text-white  transition-colors hover:bg-[var(--color-navy-soft)]"
        >
          <X size={18} strokeWidth={2.4} />
        </button>

        <div className="flex flex-col gap-5 text-[#111111]">
          <div className="flex flex-col gap-3">
            <h2 id="vector-conversion-title" className="text-2xl font-bold tracking-normal">
              Convert your artwork in three steps
            </h2>
            <div className="flex flex-col gap-2 text-sm leading-relaxed text-[#111111]/80">
              <p id="vector-conversion-description">
                Why vector files? Vector graphics are made from paths, not pixels, which means
                they scale without losing quality.
              </p>
              <p>
                They also allow us to separate colours and layers precisely, essential for
                techniques like screen printing, embroidery, and others.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="techpack-panel grid gap-4 rounded-[4px] border p-5 sm:grid-cols-[32px_minmax(0,1fr)_auto] sm:items-center">
              <span className="text-2xl font-bold">1</span>
              <div className="flex flex-col gap-2">
                <h3 className="text-base font-bold">Access Converter and upload your file</h3>
                <p className="max-w-[420px] text-sm leading-relaxed text-[#111111]/75">
                  Upload your image file (e.g., .jpg, .png, etc.). The tool will help you convert
                  your design into a high-quality vector file.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenConverter}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[4px] bg-[var(--color-accent)] px-5 text-sm font-bold text-white transition-colors hover:bg-[var(--color-accent-dark)]"
              >
                Access Converter
                <ExternalLink size={15} strokeWidth={2.3} />
              </button>
            </div>

            <div className="techpack-panel grid gap-4 rounded-[4px] border p-5 sm:grid-cols-[32px_minmax(0,1fr)]">
              <span className="text-2xl font-bold">2</span>
              <div className="flex flex-col gap-2">
                <h3 className="text-base font-bold">Download your converted file</h3>
                <p className="max-w-[520px] text-sm leading-relaxed text-[#111111]/75">
                  Once the conversion is completed, download the resulting .svg vector file. Make
                  sure everything looks correct: sharp, clean and free of artifacts.
                </p>
              </div>
            </div>

            <div className="techpack-panel grid gap-4 rounded-[4px] border p-5 sm:grid-cols-[32px_minmax(0,1fr)_auto] sm:items-center">
              <span className="text-2xl font-bold">3</span>
              <div className="flex flex-col gap-2">
                <h3 className="text-base font-bold">Upload your .svg in Studio</h3>
                <p className="max-w-[420px] text-sm leading-relaxed text-[#111111]/75">
                  Return to the Studio and upload the converted file. This ensures you have access
                  to all artwork techniques.
                </p>
              </div>
              <button
                type="button"
                onClick={onUploadToStudio}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[4px] bg-[var(--color-accent)] px-5 text-sm font-bold text-white transition-colors hover:bg-[var(--color-accent-dark)]"
              >
                Upload to Studio
                <Upload size={15} strokeWidth={2.3} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ArtworkUploadSide({ side, value, onChange }: ArtworkUploadSideProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingObjectUrlRef = useRef<string | null>(null);
  const importTokenRef = useRef(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressDoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { updatePosition } = useArtworkPosition();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolutionWarning, setResolutionWarning] = useState<string | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null); // null = not uploading
  const [showConversionGuide, setShowConversionGuide] = useState(false);

  const requiresVector =
    !!value?.technique && VECTOR_REQUIRED_TECHNIQUES.includes(value.technique) && !value.vectorized;

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (progressDoneTimerRef.current) clearTimeout(progressDoneTimerRef.current);
      revokeObjectUrl(pendingObjectUrlRef.current ?? undefined);
      pendingObjectUrlRef.current = null;
    };
  }, []);

  const clearFakeProgress = useCallback(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (progressDoneTimerRef.current) clearTimeout(progressDoneTimerRef.current);
    progressIntervalRef.current = null;
    progressDoneTimerRef.current = null;
  }, []);

  const runFakeProgress = useCallback((token: number, onDone: () => void) => {
    clearFakeProgress();
    setProgress(0);
    let pct = 0;
    progressIntervalRef.current = setInterval(() => {
      if (token !== importTokenRef.current) {
        clearFakeProgress();
        return;
      }
      pct += 20;
      setProgress(Math.min(pct, 100));
      if (pct >= 100) {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
        progressDoneTimerRef.current = setTimeout(() => {
          progressDoneTimerRef.current = null;
          if (token !== importTokenRef.current) return;
          setProgress(null);
          onDone();
        }, 200);
      }
    }, 120);
  }, [clearFakeProgress]);

  async function importArtwork(
    fileUrl: string,
    fileType: ArtworkFileType,
    token: number,
    fileKey?: string,
    fileName?: string
  ) {
    const dimensions = await getDefaultArtworkDimensions(fileUrl, fileType);
    const diagnostics = fileType === "jpg" || fileType === "png"
      ? await analyseRasterArtwork(fileUrl).catch(() => ({}))
      : {};
    if (token !== importTokenRef.current) {
      revokeObjectUrl(fileUrl);
      return;
    }
    if (pendingObjectUrlRef.current === fileUrl) {
      pendingObjectUrlRef.current = null;
    }
    updatePosition(side, {
      widthCm: dimensions.width,
      heightCm: dimensions.height,
      fromNeckCm: 5,
      fromCenterCm: 0,
    });
    onChange(
      makeDefaultSide(
        fileUrl,
        fileType,
        dimensions,
        value?.technique,
        fileKey,
        fileName,
        diagnostics
      )
    );
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    const fileType = extensionToFileType(file.name);
    if (!fileType) {
      setError("Unsupported file type. Accepted: .jpg, .jpeg, .png, .svg, .ai");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("File is too large. Maximum size is 4.5 MB.");
      return;
    }
    setError(null);
    setResolutionWarning(null);
    trackConfiguratorEvent("artwork_upload_started", { side, file_type: fileType, file_size: file.size });
    setPersistenceWarning(null);

    const fileUrl = URL.createObjectURL(file);
    revokeObjectUrl(pendingObjectUrlRef.current ?? undefined);
    pendingObjectUrlRef.current = fileUrl;
    const token = importTokenRef.current + 1;
    importTokenRef.current = token;
    if (fileType === "jpg" || fileType === "png") {
      void getImageDimensions(fileUrl)
        .then(({ naturalWidth, naturalHeight }) => {
          if (token !== importTokenRef.current) return;
          if (naturalWidth < 1200 || naturalHeight < 600) {
            setResolutionWarning(
              `This raster file is ${naturalWidth}x${naturalHeight}px. It may print soft at large sizes; upload a higher-res file or convert to SVG.`
            );
          }
        })
        .catch(() => {
          if (token === importTokenRef.current) {
            setError("This image could not be read. Your other selections are safe. Try exporting it again or upload another file.");
            trackConfiguratorEvent("artwork_upload_failed", { side, reason: "unreadable_image" });
          }
        });
    }
    const persistedFile = persistUploadedFile(file);
    runFakeProgress(token, () => {
      void persistedFile
        .then(async (fileKey) => {
          if (token !== importTokenRef.current) return;
          if (!fileKey) {
            setPersistenceWarning(
              "This browser could not save the upload for reload recovery. Keep this tab open or try a different browser."
            );
          }
          await importArtwork(fileUrl, fileType, token, fileKey, file.name);
          if (token === importTokenRef.current) {
            trackConfiguratorEvent("artwork_upload_succeeded", { side, file_type: fileType });
          }
        })
        .catch(() => {
          if (token !== importTokenRef.current) return;
          revokeObjectUrl(fileUrl);
          if (pendingObjectUrlRef.current === fileUrl) {
            pendingObjectUrlRef.current = null;
          }
          setError("This artwork could not be imported. Try exporting it again or upload another file.");
          trackConfiguratorEvent("artwork_upload_failed", { side, reason: "import_failed" });
        });
    });
  }

  function handleRemove() {
    importTokenRef.current += 1;
    clearFakeProgress();
    revokeObjectUrl(pendingObjectUrlRef.current ?? undefined);
    pendingObjectUrlRef.current = null;
    onChange(undefined);
    setError(null);
    setResolutionWarning(null);
    setPersistenceWarning(null);
    setProgress(null);
  }

  function handleTrySample() {
    importTokenRef.current += 1;
    clearFakeProgress();
    revokeObjectUrl(pendingObjectUrlRef.current ?? undefined);
    pendingObjectUrlRef.current = null;
    const token = importTokenRef.current;
    runFakeProgress(token, () => {
      void importArtwork(SAMPLE_ARTWORK_HREF, "svg", token).catch(() => {
        if (token !== importTokenRef.current) return;
        setError("The sample artwork could not be loaded. Upload your own file or try again.");
        trackConfiguratorEvent("artwork_upload_failed", { side, reason: "sample_import_failed" });
      });
    });
  }

  function handleConvertArtwork() {
    setShowConversionGuide(true);
  }

  function handleOpenConverter() {
    window.open(VECTORIZER_HREF, "_blank", "noopener,noreferrer");
  }

  function handleUploadToStudio() {
    setShowConversionGuide(false);
    inputRef.current?.click();
  }

  const isPending = progress !== null;
  const filename = value?.fileName ?? value?.fileUrl.split("/").pop() ?? "";

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />

      {!value ? (
        <div
          data-dragging={dragging ? "true" : "false"}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            handleFiles(event.dataTransfer.files);
          }}
          className="techpack-dropzone relative flex flex-col items-center overflow-hidden rounded-[4px] px-4 py-5 text-center transition-all duration-200"
        >
          {isPending && (
            <span className="techpack-control absolute right-3 top-3 z-20 rounded-[4px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent-dark)]">
              Uploading
            </span>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="group relative z-10 flex min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-[4px] px-3 transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            <span className="techpack-control mb-1 flex h-10 w-10 items-center justify-center rounded-[4px] border text-[var(--color-accent-dark)] transition-transform group-hover:-translate-y-0.5">
              <Upload size={17} strokeWidth={2.2} aria-hidden="true" />
            </span>
            <span className="text-sm font-medium text-[#111111]">
              Drag and drop artwork, or click to browse
            </span>
            <span className="text-xs text-[#111111]/50">Accepts .jpg, .jpeg, .png, .svg and .ai up to 4.5 MB</span>
          </button>
          <div className="relative z-10 mt-3 flex flex-wrap items-center justify-center gap-2">
            <a
              href={PRINT_TEMPLATES_HREF}
              download
              className="techpack-control inline-flex min-h-9 items-center gap-1.5 rounded-[4px] border px-3 text-xs font-medium text-[#111111]/80 transition-colors hover:!border-[var(--color-accent)]/45 hover:text-[var(--color-accent-dark)]"
            >
              Download templates
              <Download size={13} strokeWidth={2.2} />
            </a>
            <button
              type="button"
              onClick={handleTrySample}
              className="techpack-control min-h-9 rounded-[4px] border !border-[var(--color-accent)]/30 px-3 text-xs font-semibold text-[var(--color-accent-dark)] transition-colors hover:!border-[var(--color-accent)]/55 hover:!bg-white/55"
            >
              Try sample artwork
            </button>
          </div>
        </div>
      ) : (
        <div className="techpack-subtle flex flex-col gap-2 rounded-[4px] p-3">
          <div className="flex items-center gap-3">
            <div className="techpack-control flex h-10 w-10 shrink-0 items-center justify-center border text-[10px] uppercase text-[#111111]/50">
              {value.fileType}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-[#111111]">{filename || "artwork"}</p>
              {isPending && (
                <div className="mt-1 h-1 w-full overflow-hidden rounded-[4px] bg-[#E5E5E5]">
                  <div
                    className="h-full bg-[var(--color-accent)] transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
            {!isPending && <span className="text-green-600">✓</span>}
            <button
              type="button"
              onClick={handleRemove}
              aria-label="Remove artwork"
              className="text-red-600 hover:text-red-700"
            >
              🗑
            </button>
          </div>

          {requiresVector && (
            <div className="flex flex-col gap-2 border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              <p>
                This technique usually needs vector artwork for production. You can continue with this file; our team will review and prepare it before final approval.
              </p>
              <button
                type="button"
                onClick={handleConvertArtwork}
                className="self-start border border-amber-900 px-2 py-1 uppercase tracking-wide hover:bg-amber-900 hover:text-amber-50"
              >
                Convert file (optional)
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      {resolutionWarning && (
        <p className="rounded-[4px] border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          {resolutionWarning}
        </p>
      )}
      {persistenceWarning && (
        <p className="rounded-[4px] border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          {persistenceWarning}
        </p>
      )}

      {showConversionGuide && (
        <VectorConversionDialog
          onClose={() => setShowConversionGuide(false)}
          onOpenConverter={handleOpenConverter}
          onUploadToStudio={handleUploadToStudio}
        />
      )}
    </div>
  );
}
