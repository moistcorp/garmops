"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import type { GarmentColour } from "@/lib/configurator/types/configurator";
import {
  SIGNATURE_COLOURS,
  CUSTOM_DYE_MOQ_UNITS,
  CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS,
} from "@/lib/configurator/colourRules";
import type { PantoneColour } from "@/lib/configurator/pantoneLibrary";
import { CUSTOM_DYE_UNIT_INCREASE_PERCENT, formatInr } from "@/lib/configurator/pricing";
import SignatureColourGrid from "./SignatureColourGrid";

const CustomDyePantoneGrid = dynamic(
  () => import("./CustomDyePantoneGrid"),
  {
    loading: () => (
      <div className="techpack-subtle rounded-[4px] p-4 text-sm text-[var(--text-primary)]/55">
        Preparing the Pantone browser…
      </div>
    ),
  },
);

interface GarmentColourPanelProps {
  value: GarmentColour;
  onChange: (colour: GarmentColour) => void;
  /** Undiscounted per-unit base price, if known, so the Custom Dye delta can
   *  be shown as a real amount rather than only a percentage. */
  unitBasePrice?: number;
}

export default function GarmentColourPanel({ value, onChange, unitBasePrice }: GarmentColourPanelProps) {
  const [pantoneColours, setPantoneColours] = useState<PantoneColour[] | null>(null);
  const [isLoadingPantones, setIsLoadingPantones] = useState(false);
  const [pantoneError, setPantoneError] = useState("");
  const customDyeDeltaLabel =
    unitBasePrice !== undefined
      ? `+${formatInr((unitBasePrice * CUSTOM_DYE_UNIT_INCREASE_PERCENT) / 100)}/unit`
      : `+${CUSTOM_DYE_UNIT_INCREASE_PERCENT}%/unit`;

  function handleSignatureSelect(colour: { name: string; hex: string }) {
    onChange({
      type: "signature",
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

  async function loadPantoneLibrary() {
    if (pantoneColours || isLoadingPantones) return;

    setIsLoadingPantones(true);
    setPantoneError("");
    try {
      const module = await import("@/lib/configurator/pantoneLibrary");
      setPantoneColours(module.PANTONE_COLOURS);
    } catch {
      setPantoneError("The Pantone library could not be loaded. Please try again.");
    } finally {
      setIsLoadingPantones(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="techpack-subtle flex items-center justify-between gap-2 rounded-[4px] px-3 py-2">
          <div>
            <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-primary)]">Signature colours</h3>
            <p className="text-xs text-[var(--text-primary)]/55">
              Ready stock — 50-unit order minimum, standard lead time
            </p>
          </div>
          <span className="techpack-control shrink-0 rounded-[4px] border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[#2E7D32]">
            Included
          </span>
        </div>
        <SignatureColourGrid
          colours={SIGNATURE_COLOURS}
          selectedName={value.type === "signature" ? value.name : ""}
          onSelect={handleSignatureSelect}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-white/55 pt-6">
        <div className="techpack-subtle flex items-center justify-between gap-2 rounded-[4px] px-3 py-2">
          <div>
            <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-primary)]">Custom dye / Pantone</h3>
            <p className="text-xs text-[var(--text-primary)]/55">
              Choose from the currently available dye-to-match references.
            </p>
          </div>
          <span className="shrink-0 rounded-[4px] border border-[#8A6212]/30 bg-[#FFFBF2] px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.04em] text-[#8A6212]">
            {customDyeDeltaLabel}
          </span>
        </div>
        <p className="rounded-[4px] border border-[#8A6212]/30 bg-[#FFFBF2] px-3 py-2 text-xs leading-relaxed text-[#8A6212]">
          Dye-to-match runs a dedicated batch: minimum {CUSTOM_DYE_MOQ_UNITS} units per colour,
          and adds {CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS.min}–{CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS.max} days
          to your production lead time.
        </p>
        <p className="text-xs leading-relaxed text-[var(--text-primary)]/55">
          Screen swatches are previews only. The final shade is confirmed using a physical lab dip before production.
        </p>

        {pantoneColours ? (
          <CustomDyePantoneGrid
            colours={pantoneColours}
            selectedCode={value.type === "custom_dye" ? value.name : null}
            onSelect={handlePantoneSelect}
          />
        ) : (
          <div className="techpack-subtle rounded-[4px] border border-dashed p-4">
            {value.type === "custom_dye" ? (
              <p className="mb-3 text-xs font-medium text-[var(--text-primary)]/70">
                Current selection: {value.name}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void loadPantoneLibrary()}
              disabled={isLoadingPantones}
              className="techpack-control w-full rounded-[4px] border px-4 py-2.5 text-sm font-semibold hover:!border-[var(--color-accent)]/45 hover:!bg-white/60 disabled:cursor-wait disabled:opacity-60"
            >
              {isLoadingPantones ? "Loading Pantone library…" : value.type === "custom_dye" ? "Change Pantone colour" : "Browse Pantone library"}
            </button>
            {pantoneError ? (
              <p className="mt-2 text-xs text-red-700" role="alert">
                {pantoneError}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
