"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import type { GarmentColour } from "@/lib/configurator/types/configurator";
import {
  CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS,
  CUSTOM_DYE_MOQ_UNITS,
  SIGNATURE_COLOURS,
} from "@/lib/configurator/colourRules";
import type { PantoneColour } from "@/lib/configurator/pantoneLibrary";
import { CUSTOM_DYE_UNIT_INCREASE_PERCENT, formatInr } from "@/lib/configurator/pricing";
import SignatureColourGrid from "./SignatureColourGrid";

const CustomDyePantoneGrid = dynamic(
  () => import("./CustomDyePantoneGrid"),
  {
    loading: () => (
      <div className="techpack-subtle rounded-sm p-4 text-sm text-(--text-primary)/55" role="status">
        Preparing colour references…
      </div>
    ),
  },
);

type ColourMode = "signature" | "custom";

interface GarmentColourPanelProps {
  value: GarmentColour;
  onChange: (colour: GarmentColour) => void;
  /** Undiscounted per-unit base price, if known, so the Custom Dye delta can
   *  be shown as a real amount rather than only a percentage. */
  unitBasePrice?: number;
  quantity?: number;
  minimumQuantity?: number;
  onQuantityChange?: (quantity: number) => void;
}

function SelectedColourSummary({ value }: { value: GarmentColour }) {
  const isCustom = value.type === "custom_dye";

  return (
    <section
      aria-label="Selected colour"
      className="rounded-sm border border-(--color-control-border) bg-white px-3 py-3"
    >
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-(--text-primary)/50">
          Selected colour
      </p>
      <div className="mt-2 flex items-center gap-3">
        <span
          className="h-14 w-14 shrink-0 rounded-sm border border-(--color-rule) shadow-sm"
          style={{ backgroundColor: value.hex }}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-(--text-primary)">{value.name}</p>
          {isCustom && (
            <>
              <p className="mt-0.5 text-xs text-(--text-primary)/55">Custom colour reference</p>
              <p className="mt-1 font-mono text-xs font-semibold uppercase tracking-[0.05em] text-(--color-accent)">
                Preview only
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default function GarmentColourPanel({
  value,
  onChange,
  unitBasePrice,
  quantity,
  minimumQuantity,
  onQuantityChange,
}: GarmentColourPanelProps) {
  const [mode, setMode] = useState<ColourMode>(value.type === "custom_dye" ? "custom" : "signature");
  const [pantoneColours, setPantoneColours] = useState<PantoneColour[] | null>(null);
  const [isLoadingPantones, setIsLoadingPantones] = useState(false);
  const [pantoneError, setPantoneError] = useState("");
  const pantoneLoadAttempted = useRef(false);
  const customDyeMinimum = minimumQuantity ?? CUSTOM_DYE_MOQ_UNITS;
  const customDyeDeltaLabel =
    unitBasePrice !== undefined
      ? `+${formatInr((unitBasePrice * CUSTOM_DYE_UNIT_INCREASE_PERCENT) / 100)}/unit`
      : `+${CUSTOM_DYE_UNIT_INCREASE_PERCENT}%/unit`;
  const customQuantityShortfall =
    value.type === "custom_dye" && quantity !== undefined && quantity < customDyeMinimum;

  useEffect(() => {
    if (
      mode !== "custom" ||
      pantoneColours ||
      isLoadingPantones ||
      pantoneLoadAttempted.current
    ) {
      return;
    }

    pantoneLoadAttempted.current = true;
    setIsLoadingPantones(true);
    setPantoneError("");
    void import("@/lib/configurator/pantoneLibrary")
      .then((pantoneLibrary) => {
        setPantoneColours(pantoneLibrary.PANTONE_COLOURS);
      })
      .catch(() => {
        setPantoneError("Colour references could not be loaded. Please try again.");
      })
      .finally(() => {
        setIsLoadingPantones(false);
      });
  }, [isLoadingPantones, mode, pantoneColours]);

  function changeMode(nextMode: ColourMode) {
    setMode(nextMode);
    if (nextMode === "custom" && !pantoneColours) {
      pantoneLoadAttempted.current = false;
    }
  }

  function retryPantoneLibrary() {
    pantoneLoadAttempted.current = false;
    setPantoneError("");
  }

  function handleSignatureSelect(colour: { id: string; name: string; hex: string }) {
    onChange({
      type: "signature",
      id: colour.id,
      name: colour.name,
      hex: colour.hex,
      confirmed: value.confirmed,
    });
  }

  function handlePantoneSelect(colour: { code: string; hex: string }) {
    onChange({
      type: "custom_dye",
      name: colour.code,
      hex: colour.hex,
      confirmed: value.confirmed,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-(--text-primary)">
          Choose your garment colour
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-(--text-primary)/60">
          Choose a standard colour, or match a specific brand colour with custom dye.
        </p>
      </div>

      <div role="tablist" aria-label="Garment colour type" className="grid grid-cols-2 border-b border-(--color-rule)">
        <button
          id="signature-colours-tab"
          type="button"
          role="tab"
          aria-selected={mode === "signature"}
          aria-controls="signature-colours-panel"
          onClick={() => changeMode("signature")}
          className={`min-h-10 border-b-2 px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent) ${
            mode === "signature"
              ? "border-(--color-accent) text-(--color-accent)"
              : "border-transparent text-(--text-primary)/50 hover:text-(--text-primary)"
          }`}
        >
          Signature Colours
        </button>
        <button
          id="custom-colour-tab"
          type="button"
          role="tab"
          aria-selected={mode === "custom"}
          aria-controls="custom-colour-panel"
          onClick={() => changeMode("custom")}
          className={`min-h-10 border-b-2 px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent) ${
            mode === "custom"
              ? "border-(--color-accent) text-(--color-accent)"
              : "border-transparent text-(--text-primary)/50 hover:text-(--text-primary)"
          }`}
        >
          Custom Colour
        </button>
      </div>

      {mode === "signature" ? (
        <section id="signature-colours-panel" role="tabpanel" aria-labelledby="signature-colours-tab" className="flex flex-col gap-3">
          <SelectedColourSummary value={value} />
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-(--text-primary)/55">
                Signature colours
              </h2>
          <span className="text-xs text-(--text-primary)/45">Standard colour</span>
            </div>
            <SignatureColourGrid
              colours={SIGNATURE_COLOURS}
              selectedId={value.type === "signature" ? value.id : undefined}
              onSelect={handleSignatureSelect}
            />
          </div>
          <p className="text-xs leading-relaxed text-(--text-primary)/50">
            Signature colours carry no colour surcharge in the current pricing rules.
          </p>
        </section>
      ) : (
        <section id="custom-colour-panel" role="tabpanel" aria-labelledby="custom-colour-tab" className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-(--text-primary)">Custom Colour</h2>
            <p className="mt-1 text-sm leading-relaxed text-(--text-primary)/60">
              Match a specific brand colour using a production colour reference.
            </p>
          </div>

          <div className="grid grid-cols-3 divide-x divide-(--color-rule) rounded-sm border border-(--color-rule) bg-white">
            <div className="min-w-0 px-2.5 py-2.5">
              <p className="font-mono text-xs font-semibold text-(--text-primary)">{customDyeMinimum} pcs</p>
              <p className="mt-1 text-xs leading-relaxed text-(--text-primary)/55">minimum / colour</p>
            </div>
            <div className="min-w-0 px-2.5 py-2.5">
              <p className="font-mono text-xs font-semibold text-(--text-primary)">{customDyeDeltaLabel}</p>
              <p className="mt-1 text-xs leading-relaxed text-(--text-primary)/55">price adjustment</p>
            </div>
            <div className="min-w-0 px-2.5 py-2.5">
              <p className="font-mono text-xs font-semibold text-(--text-primary)">+{CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS.min}–{CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS.max} days</p>
              <p className="mt-1 text-xs leading-relaxed text-(--text-primary)/55">production time</p>
            </div>
          </div>

          {customQuantityShortfall && onQuantityChange ? (
            <div className="rounded-sm border border-[#8A6212]/30 bg-[#FFFBF2] px-3 py-2.5 text-xs leading-relaxed text-[#6E4D08]">
              <p>Custom colour needs at least {customDyeMinimum} pieces. Your quantity is currently {quantity}.</p>
              <button
                type="button"
                onClick={() => onQuantityChange(customDyeMinimum)}
                className="mt-2 rounded-sm border border-[#8A6212]/35 bg-white/70 px-3 py-1.5 text-xs font-semibold hover:bg-white"
              >
                Set quantity to {customDyeMinimum} pieces
              </button>
            </div>
          ) : null}

          {value.type === "custom_dye" ? <SelectedColourSummary value={value} /> : null}

          <p className="rounded-sm border border-[#8A6212]/30 bg-[#FFFBF2] px-3 py-2.5 text-xs leading-relaxed text-[#6E4D08]">
            Screen colours are previews only. Your final custom shade is approved through a physical lab dip before production.
          </p>

          {pantoneColours ? (
            <CustomDyePantoneGrid
              colours={pantoneColours}
              selectedCode={value.type === "custom_dye" ? value.name : null}
              onSelect={handlePantoneSelect}
            />
          ) : isLoadingPantones ? (
            <div className="techpack-subtle rounded-sm border border-dashed p-4 text-sm text-(--text-primary)/55" role="status" aria-live="polite">
              Preparing colour references…
            </div>
          ) : (
            <div className="techpack-subtle rounded-sm border border-dashed p-4">
              <p className="text-sm text-(--text-primary)/60">
                Colour references are temporarily unavailable.
              </p>
              <button
                type="button"
                onClick={retryPantoneLibrary}
                className="mt-3 rounded-sm border border-(--color-rule) px-3 py-2 text-xs font-semibold hover:border-(--color-accent)/45 hover:bg-white/60"
              >
                Try again
              </button>
              {pantoneError ? <p className="sr-only" role="alert">{pantoneError}</p> : null}
            </div>
          )}

          {value.type === "custom_dye" ? <SelectedColourSummary value={value} /> : null}
        </section>
      )}
    </div>
  );
}
