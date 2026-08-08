"use client";

import { useMemo, useState } from "react";
import type { PantoneColour } from "@/lib/configurator/pantoneLibrary";

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
  const [browseAll, setBrowseAll] = useState(false);
  const hasSearch = query.trim().length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return colours;
    return colours.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.aliases.some((alias) => alias.toLowerCase().includes(q))
    );
  }, [colours, query]);
  const visibleColours = hasSearch || browseAll ? filtered.slice(0, visibleCount) : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <label
          htmlFor="custom-colour-search"
          className="mb-1.5 block text-xs font-semibold text-[var(--text-primary)]"
        >
          Search your colour
        </label>
        <input
          id="custom-colour-search"
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setVisibleCount(PAGE_SIZE);
            if (event.target.value.trim()) setBrowseAll(false);
          }}
          placeholder="Colour reference or name (e.g. navy, maroon)"
          className="techpack-control w-full rounded-[4px] border px-3 py-2 text-sm placeholder:text-[var(--text-primary)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        />
        <p className="mt-1.5 text-[10px] text-[var(--text-primary)]/45">
          {hasSearch || browseAll
            ? `${filtered.length.toLocaleString("en-IN")} matching colour${filtered.length === 1 ? "" : "s"}`
            : "Search by code or name, or browse the full reference list."}
        </p>
      </div>

      <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-primary)]/55">
        Matching colours
      </h3>

      {visibleColours.length > 0 ? (
        <div className="grid grid-cols-2 gap-3" aria-live="polite">
          {visibleColours.map((colour) => {
            const isActive = colour.code === selectedCode;
            return (
              <button
                key={colour.code}
                type="button"
                onClick={() => onSelect(colour)}
                aria-pressed={isActive}
                aria-label={`Select colour reference ${colour.code}`}
                className={`group relative flex min-h-20 items-center gap-2 rounded-[4px] border p-2 text-left text-sm transition-colors ${
                  isActive
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/6 ring-2 ring-[var(--color-accent)]/25"
                    : "techpack-control border hover:!border-[var(--color-accent)]/35 hover:!bg-white/55"
                }`}
              >
                <span
                  className="h-11 w-11 shrink-0 rounded-[4px] border border-[var(--color-rule)]"
                  style={{ backgroundColor: colour.hex }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[10px] font-semibold uppercase tracking-[0.04em]">{colour.code}</span>
                  <span className="mt-0.5 block truncate text-[9px] text-[var(--text-primary)]/50">{colour.aliases[0] ?? "Colour reference"}</span>
                  {isActive ? <span className="mt-1 block text-[9px] font-semibold text-[var(--color-accent)]">Selected</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : hasSearch ? (
        <p className="py-3 text-center text-sm text-[var(--text-primary)]/55" role="status">
          No matching colours found. Try another code or colour name.
        </p>
      ) : (
        <p className="rounded-[4px] border border-dashed border-[var(--color-rule)] px-3 py-3 text-center text-xs text-[var(--text-primary)]/55">
          Enter a search above to see matching references.
        </p>
      )}

      {!browseAll && !hasSearch ? (
        <button
          type="button"
          onClick={() => {
            setBrowseAll(true);
            setVisibleCount(PAGE_SIZE);
          }}
          className="techpack-control self-start rounded-[4px] border px-3 py-2 text-xs font-semibold text-[var(--color-accent)] hover:!border-[var(--color-accent)]/45 hover:!bg-white/60"
        >
          Browse all colours →
        </button>
      ) : null}

      {(hasSearch || browseAll) && visibleCount < filtered.length && (
        <button
          type="button"
          onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
          className="techpack-control self-center rounded-[4px] border px-4 py-2 text-xs font-semibold text-[var(--text-primary)]/65 hover:!border-[var(--color-accent)]/45 hover:!bg-white/60 hover:text-[var(--text-primary)]"
        >
          Show more colours
        </button>
      )}
    </div>
  );
}
