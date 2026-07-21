"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import type { PantoneColour } from "@/lib/configurator/colours";
import { useFavouritePantones } from "./useColourMemory";
import SwatchHoverPreview from "./SwatchHoverPreview";

interface CustomDyePantoneGridProps {
  colours: PantoneColour[];
  selectedCode: string | null;
  onSelect: (colour: PantoneColour) => void;
}

export default function CustomDyePantoneGrid({
  colours,
  selectedCode,
  onSelect,
}: CustomDyePantoneGridProps) {
  const [query, setQuery] = useState("");
  const { favourites, toggleFavourite } = useFavouritePantones();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return colours;
    return colours.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.aliases.some((alias) => alias.toLowerCase().includes(q))
    );
  }, [colours, query]);

  // Favourited colours (that also match the current search) surface first
  // so a buyer who's dye-matched before doesn't have to hunt for it again.
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aFav = favourites.includes(a.code) ? 0 : 1;
      const bFav = favourites.includes(b.code) ? 0 : 1;
      return aFav - bFav;
    });
  }, [filtered, favourites]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by Pantone code or colour name (e.g. navy, maroon)"
          aria-label="Search Colour"
          className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-sm placeholder:text-[#111111]/40 focus:outline-none focus:ring-1 focus:ring-[#111111]"
        />
      </div>

      <div className="grid max-h-72 grid-cols-2 gap-3 overflow-y-auto pr-1">
        {sorted.map((colour) => {
          const isActive = colour.code === selectedCode;
          const isFavourite = favourites.includes(colour.code);
          return (
            <button
              key={colour.code}
              type="button"
              onClick={() => onSelect(colour)}
              aria-pressed={isActive}
              className={`group relative flex items-center gap-2 rounded-full border py-1.5 pl-2 pr-1 text-left text-sm transition-colors ${
                isActive
                  ? "border-[#111111] bg-white"
                  : "border-[#E5E5E5] bg-transparent hover:bg-[#E5E5E5]/40"
              }`}
            >
              <SwatchHoverPreview hex={colour.hex} label={colour.code} />
              <span
                className="h-6 w-6 shrink-0 rounded-full border border-[#E5E5E5]"
                style={{ backgroundColor: colour.hex }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate">{colour.code}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavourite(colour.code);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleFavourite(colour.code);
                  }
                }}
                aria-label={isFavourite ? `Unfavourite ${colour.code}` : `Favourite ${colour.code}`}
                aria-pressed={isFavourite}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#111111]/35 hover:text-[#111111]"
              >
                <Star size={13} strokeWidth={2.2} fill={isFavourite ? "currentColor" : "none"} />
              </span>
            </button>
          );
        })}

        {sorted.length === 0 && (
          <p className="col-span-2 py-4 text-center text-sm text-[#111111]/50">
            No colours match &ldquo;{query}&rdquo;.
          </p>
        )}
      </div>
    </div>
  );
}
