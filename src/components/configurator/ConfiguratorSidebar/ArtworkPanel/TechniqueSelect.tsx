"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import type {
  ArtworkFileType,
  ArtworkTechnique,
} from "@/lib/configurator/types/configurator";
import { formatInr, TECHNIQUE_UNIT_PRICE_DELTAS } from "@/lib/configurator/pricing";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";

export interface TechniqueSelectProps {
  value?: ArtworkTechnique;
  fileType?: ArtworkFileType;
  side?: "front" | "back";
  onChange: (technique: ArtworkTechnique) => void;
}

export const TECHNIQUE_LABELS: Record<ArtworkTechnique, string> = {
  screen_print: "Screen Print",
  dtg: "DTG",
  dtf: "DTF",
  reflective_heat_transfer: "Reflective Heat Transfer",
  puff_print: "Puff Print",
  embroidery: "Embroidery",
};

const TECHNIQUE_ORDER: ArtworkTechnique[] = [
  "screen_print",
  "dtg",
  "dtf",
  "reflective_heat_transfer",
  "puff_print",
  "embroidery",
];

const TECHNIQUE_DESCRIPTIONS: Record<ArtworkTechnique, string> = {
  screen_print:
    "A durable choice for bold vector artwork, clean lines and designs with a limited colour count.",
  dtg:
    "A soft-hand print suited to detailed, full-colour artwork and photographic imagery.",
  dtf:
    "A versatile option for vivid raster artwork, fine details and strong colour across fabric types.",
  reflective_heat_transfer:
    "A light-reactive finish that adds visibility and a precise, technical look.",
  puff_print:
    "Creates a raised, tactile finish that works best with bold shapes and simple artwork.",
  embroidery:
    "A premium stitched finish for logos and text with simple shapes and strong contrast.",
};

interface TechniqueCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const TECHNIQUE_CROPS: Record<ArtworkTechnique, TechniqueCrop> = {
  screen_print: { x: 29, y: 145, width: 226, height: 281 },
  reflective_heat_transfer: { x: 366, y: 145, width: 226, height: 281 },
  puff_print: { x: 682, y: 145, width: 226, height: 281 },
  dtg: { x: 28, y: 530, width: 226, height: 283 },
  dtf: { x: 366, y: 530, width: 226, height: 283 },
  embroidery: { x: 682, y: 530, width: 226, height: 283 },
};

const TECHNIQUE_SHEET_SIZE = 938;
const THUMBNAIL_SIZE = 56;

function TechniqueThumbnail({ technique }: { technique: ArtworkTechnique }) {
  const crop = TECHNIQUE_CROPS[technique];
  const scale = THUMBNAIL_SIZE / crop.width;
  const scaledCropHeight = crop.height * scale;
  const verticalCrop = Math.max(0, (scaledCropHeight - THUMBNAIL_SIZE) / 2);

  return (
    <span
      aria-hidden="true"
      className="h-14 w-14 shrink-0 rounded-xl border border-white/70 bg-white bg-no-repeat shadow-sm"
      style={{
        backgroundImage: "url(/images/print-techniques.webp)",
        backgroundSize: `${TECHNIQUE_SHEET_SIZE * scale}px ${TECHNIQUE_SHEET_SIZE * scale}px`,
        backgroundPosition: `${-crop.x * scale}px ${-crop.y * scale - verticalCrop}px`,
      }}
    />
  );
}

export function TechniqueSelect({
  value,
  fileType,
  side = "front",
  onChange,
}: TechniqueSelectProps) {
  const triggerId = useId();
  const labelId = useId();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const selectedIndex = value ? TECHNIQUE_ORDER.indexOf(value) : -1;
  const [highlightedIndex, setHighlightedIndex] = useState(
    selectedIndex >= 0 ? selectedIndex : 0
  );
  const sideLabel = side === "front" ? "Front" : "Back";

  useEffect(() => {
    if (!open) return;

    const handleOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [open]);

  function openMenu() {
    const nextIndex =
      selectedIndex >= 0
        ? selectedIndex
        : 0;
    setHighlightedIndex(nextIndex);
    setOpen(true);
    window.requestAnimationFrame(() => optionRefs.current[nextIndex]?.focus());
  }

  function chooseTechnique(technique: ArtworkTechnique) {
    onChange(technique);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
    trackConfiguratorEvent("technique_selected", {
      technique,
      file_type: fileType ?? null,
    });
  }

  function moveOptionFocus(nextIndex: number) {
    const normalized =
      (nextIndex + TECHNIQUE_ORDER.length) % TECHNIQUE_ORDER.length;
    setHighlightedIndex(normalized);
    optionRefs.current[normalized]?.focus();
  }

  function handleOptionKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveOptionFocus(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveOptionFocus(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveOptionFocus(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveOptionFocus(TECHNIQUE_ORDER.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span
          id={labelId}
          className="text-xs font-semibold leading-none tracking-normal text-[#111111]/70"
        >
          {sideLabel} Artwork Technique<span aria-hidden="true">*</span>
        </span>
        <a
          href="/how-it-works"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium leading-none tracking-normal text-[#111111]/55 underline underline-offset-2 hover:text-[#111111]"
        >
          Techniques guide
        </a>
      </div>

      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-labelledby={`${labelId} ${triggerId}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => {
          if (open) setOpen(false);
          else openMenu();
        }}
        onKeyDown={(event) => {
          if (
            !open &&
            ["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)
          ) {
            event.preventDefault();
            openMenu();
          } else if (open && event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
        className="configurator-glass-control flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3 text-left outline-none focus:!border-[var(--color-teal)]/60"
      >
        <span
          className={`text-sm font-medium leading-none tracking-normal ${
            value ? "text-[#111111]/80" : "text-[#111111]/45"
          }`}
        >
          {value ? TECHNIQUE_LABELS[value] : "Select a production technique"}
        </span>
        <ChevronDown
          size={15}
          strokeWidth={2.2}
          aria-hidden="true"
          className={`shrink-0 text-[#111111]/45 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={labelId}
          className="z-40 overflow-hidden rounded-2xl border border-[#111111]/15 bg-white/82 shadow-[0_18px_45px_rgba(22,33,43,0.18)] ring-1 ring-white/75 backdrop-blur-2xl"
        >
          <div className="relative m-2.5 overflow-hidden rounded-xl bg-[#18283B] px-4 py-4 text-white">
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-[url('/images/print-techniques.webp')] bg-[length:420%] bg-[position:96%_86%] opacity-50"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-[#172A43]/95 via-[#172A43]/75 to-[#172A43]/35"
            />
            <div className="relative flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Techniques guide</p>
                <p className="mt-1 max-w-[210px] text-[11px] leading-relaxed text-white/75">
                  See each finish in action and learn how to prepare your artwork.
                </p>
              </div>
              <a
                href="/how-it-works"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-full border border-white/70 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-white/10"
              >
                Learn more
              </a>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto p-1.5 pt-0">
            {TECHNIQUE_ORDER.map((technique, index) => {
              const selected = value === technique;
              const highlighted = highlightedIndex === index;

              return (
                <button
                  key={technique}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onFocus={() => setHighlightedIndex(index)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onKeyDown={(event) => handleOptionKeyDown(event, index)}
                  onClick={() => chooseTechnique(technique)}
                  className={`flex w-full items-start gap-3 rounded-xl px-2.5 py-3 text-left outline-none transition-colors ${
                    selected
                      ? "bg-[#EAF3F1]"
                      : highlighted
                        ? "bg-white/70"
                        : "hover:bg-white/55"
                  }`}
                >
                  <TechniqueThumbnail technique={technique} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold leading-tight tracking-normal text-[#111111]/85">
                        {TECHNIQUE_LABELS[technique]}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed tracking-normal text-[#111111]/55">
                      {TECHNIQUE_DESCRIPTIONS[technique]}
                    </span>
                    <span className="mt-1.5 block text-[10px] font-semibold text-[#111111]/45">
                      +{formatInr(TECHNIQUE_UNIT_PRICE_DELTAS[technique])}/unit
                    </span>
                  </span>
                  {selected && (
                    <Check
                      size={15}
                      strokeWidth={2.5}
                      aria-hidden="true"
                      className="mt-1 shrink-0 text-[var(--color-teal-dark)]"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!value && (
        <p className="text-xs font-medium leading-relaxed tracking-normal text-[#8A6212]">
          Select a technique to unlock artwork placement.
        </p>
      )}
    </div>
  );
}

export default TechniqueSelect;
