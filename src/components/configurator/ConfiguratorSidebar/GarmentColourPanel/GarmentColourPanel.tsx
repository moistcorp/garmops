"use client";

import { Tabs } from "@base-ui/react/tabs";
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
      className="sticky top-0 z-10 flex items-center gap-3 rounded-sm border border-(--color-control-border) bg-white px-3 py-2.5 shadow-[0_5px_14px_rgba(22,33,43,0.05)]"
    >
      <span
        className="h-9 w-9 shrink-0 rounded-sm border border-black/20 shadow-[inset_0_0_0_1px_rgba(22,33,43,0.08)]"
        style={{ backgroundColor: value.hex }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.06em] text-(--text-primary)/45">
          Selected colour
        </p>
        <p className="truncate text-sm font-semibold text-(--text-primary)">{value.name}</p>
      </div>
      <p className={`shrink-0 text-right font-mono text-[9px] font-semibold uppercase tracking-[0.05em] ${
        isCustom ? "text-(--color-accent)" : "text-(--text-primary)/50"
      }`}>
        {isCustom ? <>Custom dye<br />Preview only</> : <>Signature<br />Included</>}
      </p>
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
  const [pantoneLoadVersion, setPantoneLoadVersion] = useState(0);
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
  }, [isLoadingPantones, mode, pantoneColours, pantoneLoadVersion]);

  function changeMode(nextMode: ColourMode) {
    setMode(nextMode);
    if (nextMode === "custom" && !pantoneColours) {
      pantoneLoadAttempted.current = false;
    }
  }

  function retryPantoneLibrary() {
    pantoneLoadAttempted.current = false;
    setPantoneError("");
    setPantoneLoadVersion((current) => current + 1);
  }

  function handleSignatureSelect(colour: { id: string; name: string; hex: string }) {
    onChange({
      type: "signature",
      id: colour.id,
      name: colour.name,
      hex: colour.hex,
      confirmed: true,
    });
  }

  function handlePantoneSelect(colour: { code: string; hex: string }) {
    onChange({
      type: "custom_dye",
      name: colour.code,
      hex: colour.hex,
      confirmed: true,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-(--text-primary)">
          <span aria-hidden="true" className="mr-1 font-mono text-xs font-semibold tracking-[0.06em] text-(--color-accent)">
            02 ·
          </span>
          Choose your garment colour
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-(--text-primary)/60">
          Choose a standard colour, or match a specific brand colour with custom dye.
        </p>
      </div>

      <Tabs.Root
        value={mode}
        onValueChange={(nextMode) => changeMode(nextMode as ColourMode)}
        className="flex flex-col gap-3"
      >
        <Tabs.List
          aria-label="Garment colour type"
          activateOnFocus
          className="grid grid-cols-2 border-b border-(--color-rule)"
        >
          <Tabs.Tab
            value="signature"
            className="flex min-h-14 flex-col items-center justify-center border-b-2 border-transparent px-2 py-2 text-xs font-semibold text-(--text-primary)/50 transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-(--text-primary) aria-selected:border-(--color-accent) aria-selected:text-(--color-accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)"
          >
            <span>Signature</span>
            <span className="mt-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.05em] opacity-70">Included</span>
          </Tabs.Tab>
          <Tabs.Tab
            value="custom"
            className="flex min-h-14 flex-col items-center justify-center border-b-2 border-transparent px-2 py-2 text-xs font-semibold text-(--text-primary)/50 transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-(--text-primary) aria-selected:border-(--color-accent) aria-selected:text-(--color-accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)"
          >
            <span>Custom dye</span>
            <span className="mt-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.03em] opacity-70">
              {customDyeDeltaLabel} · {customDyeMinimum}+ pcs
            </span>
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="signature" className="flex flex-col gap-3 outline-none">
          <SelectedColourSummary value={value} />
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-(--text-primary)/55">
                Available colours
              </h2>
              <span className="text-xs text-(--text-primary)/45">Included</span>
            </div>
            <SignatureColourGrid
              colours={SIGNATURE_COLOURS}
              selectedId={value.type === "signature" ? value.id : undefined}
              onSelect={handleSignatureSelect}
            />
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="custom" className="flex flex-col gap-4 outline-none">
          {value.type === "custom_dye" ? <SelectedColourSummary value={value} /> : null}

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

          {value.type === "custom_dye" ? (
            <p className="rounded-sm border border-[#8A6212]/30 bg-[#FFFBF2] px-3 py-2.5 text-xs leading-relaxed text-[#6E4D08]">
              Screen colours are previews only. Your final custom shade is approved through a physical lab dip before production.
            </p>
          ) : null}

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
        </Tabs.Panel>
      </Tabs.Root>
    </div>
  );
}
