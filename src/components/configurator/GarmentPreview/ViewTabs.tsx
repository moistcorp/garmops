"use client";

import type { GarmentView } from "@/lib/configurator/types/garment";
import type { ProductId } from "@/lib/configurator/pricing";

interface ViewTabsProps {
  activeView: GarmentView;
  onChange: (view: GarmentView) => void;
  productId: ProductId;
  hideBackView?: boolean;
}

const VIEW_OPTIONS: { id: GarmentView; label: string }[] = [
  { id: "front", label: "Front" },
  { id: "neck", label: "Neck" },
  { id: "back", label: "Back" },
];

export default function ViewTabs({
  activeView,
  onChange,
  productId,
  hideBackView = false,
}: ViewTabsProps) {
  const isTote = productId.includes("tote");
  const viewOptions = VIEW_OPTIONS
    .filter((option) => !(hideBackView && option.id === "back"))
    .map((option) =>
      option.id === "neck" && isTote ? { ...option, label: "Label" } : option
    );

  return (
    <div
      role="tablist"
      aria-label="Garment preview view"
      className="configurator-glass-control inline-flex shrink-0 items-center gap-0.5 rounded-[4px] border p-0.5"
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
            className={`flex h-7 min-w-12 items-center justify-center rounded-[4px] px-2.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 ${
              isActive
                ? "bg-[var(--color-accent)] text-white "
                : "text-[#111111]/60 hover:bg-[var(--color-cream-soft)] hover:text-[#111111]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
