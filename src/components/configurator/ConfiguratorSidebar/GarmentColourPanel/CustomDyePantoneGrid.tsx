"use client";

import { useMemo, useState } from "react";
import type { PantoneColour } from "@/lib/configurator/colours";

interface CustomDyePantoneGridProps {
  colours: PantoneColour[];
  selectedCode: string | null;
  onSelect: (colour: PantoneColour) => void;
}

const PAGE_SIZE = 60;

export default function CustomDyePantoneGrid({
  colours,
  selectedCode,
  onSelect,
}: CustomDyePantoneGridProps) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return colours;
    return colours.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.aliases.some((alias) => alias.toLowerCase().includes(q))
    );
  }, [colours, query]);
  const visibleColours = filtered.slice(0, visibleCount);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          placeholder="Search by Pantone code or colour name (e.g. navy, maroon)"
          aria-label="Search Colour"
          className="configurator-glass-control w-full rounded-[4px] border px-3 py-2 text-sm placeholder:text-[#111111]/40 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        />
        <p className="mt-1.5 text-[10px] text-[#111111]/45">
          {filtered.length.toLocaleString("en-IN")} uncoated colour
          {filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {visibleColours.map((colour) => {
          const isActive = colour.code === selectedCode;
          return (
            <button
              key={colour.code}
              type="button"
              onClick={() => onSelect(colour)}
              aria-pressed={isActive}
              className={`group relative flex items-center gap-2 rounded-[4px] border px-2 py-1.5 text-left text-sm transition-colors ${
                isActive
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/6"
                  : "configurator-glass-control border hover:!border-[var(--color-accent)]/35 hover:!bg-white/55"
              }`}
            >
              <span
                className="h-8 w-8 shrink-0 rounded-[4px] border border-[var(--color-rule)]"
                style={{ backgroundColor: colour.hex }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate">
                <span className="block truncate font-mono text-[10px] uppercase tracking-[0.04em]">{colour.code}</span>
                <span className="mt-0.5 block truncate text-[9px] text-[#111111]/45">{colour.aliases[0] ?? "Dye reference"}</span>
              </span>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <p className="col-span-2 py-4 text-center text-sm text-[#111111]/50">
            No colours match &ldquo;{query}&rdquo;.
          </p>
        )}
      </div>

      {visibleCount < filtered.length && (
        <button
          type="button"
          onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
          className="configurator-glass-control self-center rounded-[4px] border px-4 py-2 text-xs font-semibold text-[#111111]/65 hover:!border-[var(--color-accent)]/45 hover:!bg-white/60 hover:text-[#111111]"
        >
          Show more colours
        </button>
      )}
    </div>
  );
}
