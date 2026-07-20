"use client";

import type { GarmentColour } from "@/lib/configurator/types/configurator";
import {
  SIGNATURE_COLOURS,
  PANTONE_COLOURS,
  CUSTOM_DYE_MOQ_UNITS,
  CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS,
} from "@/lib/configurator/colours";
import { CUSTOM_DYE_UNIT_INCREASE_PERCENT, formatInr } from "@/lib/configurator/pricing";
import SignatureColourGrid from "./SignatureColourGrid";
import CustomDyePantoneGrid from "./CustomDyePantoneGrid";
import { useRecentColours } from "./useColourMemory";

interface GarmentColourPanelProps {
  value: GarmentColour;
  onChange: (colour: GarmentColour) => void;
  /** Undiscounted per-unit base price, if known, so the Custom Dye delta can
   *  be shown as a real amount rather than only a percentage. */
  unitBasePrice?: number;
}

export default function GarmentColourPanel({ value, onChange, unitBasePrice }: GarmentColourPanelProps) {
  const { recent, addRecent } = useRecentColours();

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
    addRecent({ type: "signature", name: colour.name, hex: colour.hex });
  }

  function handlePantoneSelect(colour: { code: string; hex: string }) {
    onChange({
      type: "custom_dye",
      name: colour.code,
      hex: colour.hex,
      confirmed: value.confirmed,
    });
    addRecent({ type: "custom_dye", name: colour.code, hex: colour.hex });
  }

  function handleRecentSelect(entry: { type: "signature" | "custom_dye"; name: string; hex: string }) {
    onChange({
      type: entry.type,
      name: entry.name,
      hex: entry.hex,
      confirmed: value.confirmed,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {recent.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#111111]/45">
            Recently Viewed
          </h3>
          <div className="flex flex-wrap gap-2">
            {recent.map((entry) => {
              const isActive =
                value.type === entry.type && value.name.toLowerCase() === entry.name.toLowerCase();
              return (
                <button
                  key={`${entry.type}-${entry.name}`}
                  type="button"
                  onClick={() => handleRecentSelect(entry)}
                  aria-pressed={isActive}
                  title={entry.name}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    isActive ? "border-[#111111] ring-1 ring-[#111111]" : "border-[#E5E5E5]"
                  }`}
                >
                  <span
                    className="h-6 w-6 rounded-full"
                    style={{ backgroundColor: entry.hex }}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Section A — Signature */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 rounded-md bg-[#F7F7F7] px-3 py-2">
          <div>
            <h3 className="text-sm font-semibold text-[#111111]">Signature</h3>
            <p className="text-xs text-[#111111]/55">Ready stock — no MOQ, standard lead time</p>
          </div>
          <span className="shrink-0 rounded-full bg-[#EAF5EA] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#2E7D32]">
            Included
          </span>
        </div>
        <SignatureColourGrid
          colours={SIGNATURE_COLOURS}
          selectedHex={value.type === "signature" && value.name ? value.hex : ""}
          onSelect={handleSignatureSelect}
        />
      </div>

      {/* Section B — Custom Dye (below Signature, on scroll) */}
      <div className="flex flex-col gap-3 border-t border-[#E5E5E5] pt-6">
        <div className="flex items-center justify-between gap-2 rounded-md bg-[#FFF8ED] px-3 py-2">
          <div>
            <h3 className="text-sm font-semibold text-[#111111]">Custom Dye</h3>
            <p className="text-xs text-[#111111]/55">
              Match your garment colour to thousands of unique references.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[#F5E6C8] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#8A6212]">
            {customDyeDeltaLabel}
          </span>
        </div>
        <p className="rounded-md border border-[#F0E2C0] bg-[#FFFBF2] px-3 py-2 text-xs leading-relaxed text-[#8A6212]">
          Dye-to-match runs a dedicated batch: minimum {CUSTOM_DYE_MOQ_UNITS} units per colour,
          and adds {CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS.min}–{CUSTOM_DYE_EXTRA_LEAD_TIME_DAYS.max} days
          to your production lead time.
        </p>
        <CustomDyePantoneGrid
          colours={PANTONE_COLOURS}
          selectedCode={value.type === "custom_dye" ? value.name : null}
          onSelect={handlePantoneSelect}
        />
      </div>
    </div>
  );
}
