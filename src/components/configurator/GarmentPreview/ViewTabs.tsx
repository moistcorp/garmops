"use client";

import type { GarmentView } from "@/lib/configurator/types/garment";

interface ViewTabsProps {
  activeView: GarmentView;
  onChange: (view: GarmentView) => void;
}

const VIEW_OPTIONS: { id: GarmentView; label: string }[] = [
  { id: "front", label: "Front" },
  { id: "neck", label: "Neck" },
  { id: "back", label: "Back" },
];

export default function ViewTabs({ activeView, onChange }: ViewTabsProps) {
  return (
    <div className="inline-flex shrink-0 items-center rounded-full bg-[#E8E8E6] p-1 shadow-inner">
      {VIEW_OPTIONS.map((opt) => {
        const isActive = opt.id === activeView;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={isActive}
            className={`rounded-full px-5 py-1.5 text-xs font-semibold transition-colors ${
              isActive
                ? "bg-white text-[#111111] shadow-sm"
                : "text-[#111111]/60 hover:text-[#111111]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
