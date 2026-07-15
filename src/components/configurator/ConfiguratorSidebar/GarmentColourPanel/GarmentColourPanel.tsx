"use client";

import type { GarmentColour } from "@/lib/configurator/types/configurator";
import { SIGNATURE_COLOURS, PANTONE_COLOURS } from "@/lib/configurator/colours";
import SignatureColourGrid from "./SignatureColourGrid";
import CustomDyePantoneGrid from "./CustomDyePantoneGrid";

interface GarmentColourPanelProps {
  value: GarmentColour;
  onChange: (colour: GarmentColour) => void;
}

export default function GarmentColourPanel({ value, onChange }: GarmentColourPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Section A — Signature */}
      <div className="flex flex-col gap-3">
        <SignatureColourGrid
          colours={SIGNATURE_COLOURS}
          selectedHex={value.type === "signature" ? value.hex : ""}
          onSelect={(colour) =>
            onChange({
              type: "signature",
              name: colour.name,
              hex: colour.hex,
              confirmed: value.confirmed,
            })
          }
        />
      </div>

      {/* Section B — Custom Dye (below Signature, on scroll) */}
      <div className="flex flex-col gap-3 border-t border-[#E5E5E5] pt-6">
        <h3 className="text-sm font-medium">
          Match your garment colour to thousands of unique references.
        </h3>
        <CustomDyePantoneGrid
          colours={PANTONE_COLOURS}
          selectedCode={value.type === "custom_dye" ? value.name : null}
          onSelect={(colour) =>
            onChange({
              type: "custom_dye",
              name: colour.code,
              hex: colour.hex,
              confirmed: value.confirmed,
            })
          }
        />
      </div>
    </div>
  );
}