"use client";

import { useCallback, useRef, useState } from "react";
import type {
  ArtworkFileType,
  ArtworkSide,
  ArtworkTechnique,
} from "@/lib/configurator/types/configurator";

const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".svg", ".ai"];
const MAX_FILE_BYTES = 4.5 * 1024 * 1024;

const VECTOR_REQUIRED_TECHNIQUES: ArtworkTechnique[] = [
  "screen_print",
  "puff_print",
  "embroidery",
  "reflective_heat_transfer",
];

const TECHNIQUE_LABELS: Record<ArtworkTechnique, string> = {
  screen_print: "Screen Print",
  dtg: "DTG",
  dtf: "DTF",
  reflective_heat_transfer: "Reflective Heat Transfer",
  puff_print: "Puff Print",
  embroidery: "Embroidery",
};

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
  technique: ArtworkTechnique
): ArtworkSide {
  return {
    fileUrl,
    fileType,
    vectorized: fileType === "svg" || fileType === "ai",
    technique,
    width: 0,
    height: 0,
    fromNeck: 0,
    fromCenter: 0,
    printArea: "M",
    guidelines: { maximumArea: false, leftChest: false },
    confirmed: false,
  };
}

export interface ArtworkUploadSideProps {
  side: "front" | "back";
  value?: ArtworkSide;
  onChange: (side: ArtworkSide | undefined) => void;
}

export function ArtworkUploadSide({ side, value, onChange }: ArtworkUploadSideProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null); // null = not uploading

  const requiresVector =
    !!value && VECTOR_REQUIRED_TECHNIQUES.includes(value.technique) && !value.vectorized;

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

    const fileUrl = URL.createObjectURL(file);
    // Default technique intentionally does not require a vectorized file, so
    // the warning only appears once the user actively selects one that does.
    const technique = value?.technique ?? "dtg";

    runFakeProgress(() => {
      onChange(makeDefaultSide(fileUrl, fileType, technique));
    });
  }

  function handleTechniqueChange(technique: ArtworkTechnique) {
    if (!value) return;
    onChange({ ...value, technique });
  }

  function handleRemove() {
    onChange(undefined);
    setError(null);
    setProgress(null);
  }

  function handleTrySample() {
    const technique = value?.technique ?? "dtg";
    runFakeProgress(() => {
      onChange(makeDefaultSide("/sample-artwork.svg", "svg", technique));
    });
  }

  const isPending = progress !== null;
  const filename = value?.fileUrl.split("/").pop() ?? "";

  return (
    <div className="flex flex-col gap-3">
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
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(",")}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <p className="text-sm text-[#111111]">Drag and drop artwork, or click to browse</p>
          <p className="text-xs text-[#111111]/50">
            Accepts .jpg, .jpeg, .png, .svg, .ai up to 4.5MB
          </p>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="mt-2 text-xs font-medium uppercase tracking-wide text-[#111111] underline underline-offset-2 hover:no-underline"
          >
            Download Templates
          </button>
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

          <label className="flex flex-col gap-1 text-xs text-[#111111]/70">
            Technique
            <select
              value={value.technique}
              onChange={(e) => handleTechniqueChange(e.target.value as ArtworkTechnique)}
              className="border border-[#E5E5E5] bg-white px-2 py-1 text-sm text-[#111111]"
            >
              {(Object.keys(TECHNIQUE_LABELS) as ArtworkTechnique[]).map((technique) => (
                <option key={technique} value={technique}>
                  {TECHNIQUE_LABELS[technique]}
                </option>
              ))}
            </select>
          </label>

          {requiresVector && (
            <div className="flex flex-col gap-2 border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              <p>
                Some advanced techniques require a vectorized artwork file.
                Accepted formats .svg and .ai
              </p>
              <button
                type="button"
                className="self-start border border-amber-900 px-2 py-1 uppercase tracking-wide hover:bg-amber-900 hover:text-amber-50"
              >
                Convert Artwork
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}