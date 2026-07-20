"use client";

interface SwatchHoverPreviewProps {
  hex: string;
  label: string;
}

/** Appears above a colour swatch on hover/focus (via the parent's `group`
 *  class) so a buyer can get a rough sense of how a colour reads on a
 *  garment before scrolling down to the live canvas. This is a stylised
 *  silhouette, not the actual product render — the live canvas below
 *  remains the source of truth. */
export default function SwatchHoverPreview({ hex, label }: SwatchHoverPreviewProps) {
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute -top-2 left-1/2 z-20 w-28 -translate-x-1/2 -translate-y-full opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      <div className="rounded-md border border-[#E5E5E5] bg-white p-2 shadow-lg">
        <svg viewBox="0 0 64 64" className="h-14 w-full" aria-hidden="true">
          <path
            d="M22 6 L10 14 L14 24 L20 21 L20 58 L44 58 L44 21 L50 24 L54 14 L42 6 C42 10 38 13 32 13 C26 13 22 10 22 6 Z"
            fill={hex}
            stroke="#00000022"
            strokeWidth="1"
          />
        </svg>
        <p className="mt-1 truncate text-center text-[10px] font-medium text-[#111111]/70">
          {label}
        </p>
      </div>
    </div>
  );
}
