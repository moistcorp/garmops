"use client";

import { useCallback, useRef, useState } from "react";
import { Download, ExternalLink, Upload, X } from "lucide-react";
import { useArtworkPosition } from "@/lib/configurator/ArtworkPositionContext";
import type {
  ArtworkFileType,
  ArtworkSide,
  ArtworkTechnique,
} from "@/lib/configurator/types/configurator";

const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".svg", ".ai"];
const MAX_FILE_BYTES = 4.5 * 1024 * 1024;
const SAMPLE_ARTWORK_HREF = "/garments/artwork-sample.svg";
const PRINT_TEMPLATES_HREF = "/downloads/moistfoundry-print_templates-1.0.zip";
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
  technique?: ArtworkTechnique
): ArtworkSide {
  return {
    fileUrl,
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
  if (fileType === "ai") {
    return { width: DEFAULT_ARTWORK_WIDTH_CM, height: FALLBACK_VECTOR_HEIGHT_CM };
  }

  try {
    const { naturalWidth, naturalHeight } = await getImageDimensions(fileUrl);
    if (naturalWidth > 0 && naturalHeight > 0) {
      const ratio = naturalHeight / naturalWidth;
      return {
        width: DEFAULT_ARTWORK_WIDTH_CM,
        height: Math.max(1, Math.round(DEFAULT_ARTWORK_WIDTH_CM * ratio * 10) / 10),
      };
    }
  } catch {
    // Fall through to a logo-strip default for malformed/blocked preview assets.
  }

  return { width: DEFAULT_ARTWORK_WIDTH_CM, height: FALLBACK_VECTOR_HEIGHT_CM };
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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vector-conversion-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-[720px] rounded-lg bg-white p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close convert artwork guide"
          className="absolute right-[-14px] top-[-14px] flex h-9 w-9 items-center justify-center rounded-full bg-[#333333] text-white shadow-lg transition-colors hover:bg-[#111111]"
        >
          <X size={18} strokeWidth={2.4} />
        </button>

        <div className="flex flex-col gap-5 text-[#111111]">
          <div className="flex flex-col gap-3">
            <h2 id="vector-conversion-title" className="text-2xl font-bold tracking-normal">
              Convert your artwork in three steps
            </h2>
            <div className="flex flex-col gap-2 text-sm leading-relaxed text-[#111111]/80">
              <p>
                Why vector files? Vector graphics are made from paths, not pixels - which means
                they scale without losing quality.
              </p>
              <p>
                They also allow us to separate colours and layers precisely, essential for
                techniques like screen printing, embroidery, and others.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="grid gap-4 rounded-md bg-[#F1F1F1] p-5 sm:grid-cols-[32px_minmax(0,1fr)_auto] sm:items-center">
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
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#111111] px-5 text-sm font-bold text-white transition-colors hover:bg-[#333333]"
              >
                Access Converter
                <ExternalLink size={15} strokeWidth={2.3} />
              </button>
            </div>

            <div className="grid gap-4 rounded-md bg-[#F1F1F1] p-5 sm:grid-cols-[32px_minmax(0,1fr)]">
              <span className="text-2xl font-bold">2</span>
              <div className="flex flex-col gap-2">
                <h3 className="text-base font-bold">Download your converted file</h3>
                <p className="max-w-[520px] text-sm leading-relaxed text-[#111111]/75">
                  Once the conversion is completed, download the resulting .svg vector file. Make
                  sure everything looks correct - sharp, clean, and free of artifacts.
                </p>
              </div>
            </div>

            <div className="grid gap-4 rounded-md bg-[#F1F1F1] p-5 sm:grid-cols-[32px_minmax(0,1fr)_auto] sm:items-center">
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
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#111111] px-5 text-sm font-bold text-white transition-colors hover:bg-[#333333]"
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
  const { updatePosition } = useArtworkPosition();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolutionWarning, setResolutionWarning] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null); // null = not uploading
  const [showConversionGuide, setShowConversionGuide] = useState(false);

  const requiresVector =
    !!value?.technique && VECTOR_REQUIRED_TECHNIQUES.includes(value.technique) && !value.vectorized;

  const runFakeProgress = useCallback((onDone: () => void) => {
    setProgress(0);
    let pct = 0;
    const interval = setInterval(() => {
      pct += 20;
      setProgress(Math.min(pct, 100));
      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setProgress(null);
          onDone();
        }, 200);
      }
    }, 120);
  }, []);

  async function importArtwork(fileUrl: string, fileType: ArtworkFileType) {
    const dimensions = await getDefaultArtworkDimensions(fileUrl, fileType);
    updatePosition(side, {
      widthCm: dimensions.width,
      heightCm: dimensions.height,
      fromNeckCm: 5,
      fromCenterCm: 0,
    });
    onChange(makeDefaultSide(fileUrl, fileType, dimensions, value?.technique));
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
      setError("File is too large. Maximum size is 4.5MB.");
      return;
    }
    setError(null);
    setResolutionWarning(null);

    const fileUrl = URL.createObjectURL(file);
    if (fileType === "jpg" || fileType === "png") {
      void getImageDimensions(fileUrl).then(({ naturalWidth, naturalHeight }) => {
        if (naturalWidth < 1200 || naturalHeight < 600) {
          setResolutionWarning(
            `This raster file is ${naturalWidth}x${naturalHeight}px. It may print soft at large sizes; upload a higher-res file or convert to SVG.`
          );
        }
      });
    }
    runFakeProgress(() => {
      void importArtwork(fileUrl, fileType);
    });
  }

  function handleRemove() {
    onChange(undefined);
    setError(null);
    setResolutionWarning(null);
    setProgress(null);
  }

  function handleTrySample() {
    runFakeProgress(() => {
      void importArtwork(SAMPLE_ARTWORK_HREF, "svg");
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
  const filename = value?.fileUrl.split("/").pop() ?? "";

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

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-[#111111]/70">
          {side === "front" ? "Front" : "Back"}
        </span>
        {isPending && (
          <span className="rounded-full bg-[#111111]/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#111111]/60">
            Unsaved changes
          </span>
        )}
      </div>

      {!value ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`group relative flex cursor-pointer flex-col items-center justify-center gap-1 border border-dashed px-4 py-8 text-center transition-colors ${
            dragging ? "border-[#111111] bg-[#111111]/5" : "border-[#E5E5E5]"
          }`}
        >
          <p className="text-sm text-[#111111]">Drag and drop artwork, or click to browse</p>
          <p className="text-xs text-[#111111]/50">
            Accepts .jpg, .jpeg, .png, .svg, .ai up to 4.5MB
          </p>
          <a
            href={PRINT_TEMPLATES_HREF}
            download
            onClick={(e) => e.stopPropagation()}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[#111111] underline underline-offset-2 hover:no-underline"
          >
            Download Templates
            <Download size={13} strokeWidth={2.2} />
          </a>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleTrySample();
            }}
            className="pointer-events-none absolute bottom-2 right-2 rounded-full border border-[#111111] bg-[#F7F7F7] px-2 py-0.5 text-[10px] uppercase tracking-wide opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
          >
            + Try sample artwork
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 border border-[#E5E5E5] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#E5E5E5] bg-white text-[10px] uppercase text-[#111111]/50">
              {value.fileType}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-[#111111]">{filename || "artwork"}</p>
              {isPending && (
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#E5E5E5]">
                  <div
                    className="h-full bg-[#111111] transition-all"
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
                Some advanced techniques require a vectorized artwork file.
                Accepted formats .svg and .ai
              </p>
              <button
                type="button"
                onClick={handleConvertArtwork}
                className="self-start border border-amber-900 px-2 py-1 uppercase tracking-wide hover:bg-amber-900 hover:text-amber-50"
              >
                Convert Artwork
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      {resolutionWarning && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          {resolutionWarning}
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
