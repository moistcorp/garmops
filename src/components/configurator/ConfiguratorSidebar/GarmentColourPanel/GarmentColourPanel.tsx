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

interface GarmentColourPanelProps {
  value: GarmentColour;
  onChange: (colour: GarmentColour) => void;
  /** Undiscounted per-unit base price, if known, so the Custom Dye delta can
   *  be shown as a real amount rather than only a percentage. */
  unitBasePrice?: number;
}

export default function GarmentColourPanel({ value, onChange, unitBasePrice }: GarmentColourPanelProps) {
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

  return (
    <div className="flex flex-col gap-6">
      {/* Section A — Signature */}
      <div className="flex flex-col gap-3">
        <div className="techpack-subtle flex items-center justify-between gap-2 rounded-[4px] px-3 py-2">
          <div>
            <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.06em] text-[#111111]">Signature colours</h3>
            <p className="text-xs text-[#111111]/55">
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

      {/* Section B — Custom Dye */}
      <div className="flex flex-col gap-3 border-t border-white/55 pt-6">
        <div className="techpack-subtle flex items-center justify-between gap-2 rounded-[4px] px-3 py-2">
          <div>
            <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.06em] text-[#111111]">Custom dye / Pantone</h3>
            <p className="text-xs text-[#111111]/55">
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
        <p className="text-xs leading-relaxed text-[#111111]/55">
          Screen swatches are previews only. The final shade is confirmed using a physical lab dip before production.
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
