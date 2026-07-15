"use client";

import { useMemo, useState } from "react";
import type { PantoneColour } from "@/lib/configurator/colours";

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return colours;
    return colours.filter((c) => c.code.toLowerCase().includes(q));
  }, [colours, query]);

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search Colour"
        aria-label="Search Colour"
        className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-sm placeholder:text-[#111111]/40 focus:outline-none focus:ring-1 focus:ring-[#111111]"
      />

      <div className="grid max-h-72 grid-cols-2 gap-3 overflow-y-auto pr-1">
        {filtered.map((colour) => {
          const isActive = colour.code === selectedCode;
          return (
            <button
              key={colour.code}
              type="button"
              onClick={() => onSelect(colour)}
              aria-pressed={isActive}
              className={`flex items-center gap-2 rounded-full border px-2 py-1.5 text-left text-sm transition-colors ${
                isActive
                  ? "border-[#111111] bg-white"
                  : "border-[#E5E5E5] bg-transparent hover:bg-[#E5E5E5]/40"
              }`}
            >
              <span
                className="h-6 w-6 shrink-0 rounded-full border border-[#E5E5E5]"
                style={{ backgroundColor: colour.hex }}
                aria-hidden="true"
              />
              <span className="truncate">{colour.code}</span>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <p className="col-span-2 py-4 text-center text-sm text-[#111111]/50">
            No colours match &ldquo;{query}&rdquo;.
          </p>
        )}
      </div>
    </div>
  );
}