"use client";

import type { GarmentView } from "@/lib/configurator/types/garment";
import type { ProductId } from "@/lib/configurator/pricing";

interface ViewTabsProps {
  activeView: GarmentView;
  onChange: (view: GarmentView) => void;
  productId: ProductId;
}

const VIEW_OPTIONS: { id: GarmentView; label: string }[] = [
  { id: "front", label: "Front" },
  { id: "neck", label: "Neck" },
  { id: "back", label: "Back" },
];

export default function ViewTabs({ activeView, onChange, productId }: ViewTabsProps) {
  const isTote = productId.includes("tote");
  const viewOptions = VIEW_OPTIONS.map((option) =>
    option.id === "neck" && isTote ? { ...option, label: "Label" } : option
  );

  return (
    <div
      role="tablist"
      aria-label="Garment preview view"
      className="inline-flex shrink-0 items-center rounded-lg border border-[#E5E5E5] bg-white/85 p-1 shadow-sm"
    >
      {viewOptions.map((opt, index) => {
        const isActive = opt.id === activeView;
        return (
          <button
            key={opt.id}
            type="button"
            id={`garment-view-tab-${opt.id}`}
            onClick={() => onChange(opt.id)}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const nextIndex = event.key === "Home"
                ? 0
                : event.key === "End"
                  ? viewOptions.length - 1
                  : event.key === "ArrowRight"
                    ? (index + 1) % viewOptions.length
                    : (index - 1 + viewOptions.length) % viewOptions.length;
              const nextView = viewOptions[nextIndex];
              onChange(nextView.id);
              window.requestAnimationFrame(() => {
                document.getElementById(`garment-view-tab-${nextView.id}`)?.focus();
              });
            }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`min-h-11 rounded-md px-5 py-1.5 text-xs font-semibold transition-colors ${
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
