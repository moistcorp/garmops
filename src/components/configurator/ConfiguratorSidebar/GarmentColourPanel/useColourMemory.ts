"use client";

import { useCallback, useEffect, useState } from "react";

export interface RecentColourEntry {
  type: "signature" | "custom_dye";
  /** Display name (Signature) or Pantone code (Custom Dye) — doubles as the
   *  dedupe key within its type. */
  name: string;
  hex: string;
}

const RECENT_KEY = "mf_configurator_recent_colours";
const FAVOURITES_KEY = "mf_configurator_favourite_pantones";
const MAX_RECENT = 6;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Recents/favourites are a nice-to-have — a full localStorage quota or
    // private-browsing restriction shouldn't break colour selection.
  }
}

/** Tracks the last few colours a buyer has actually selected (Signature or
 *  Custom Dye), persisted across visits so returning buyers see their
 *  choices at the top of the panel instead of re-scrolling to find them. */
export function useRecentColours() {
  // Deterministic empty state for the first render (server AND client) —
  // reading localStorage inside the useState initializer returned the
  // real, already-saved list on the client's first render but not on the
  // server's, so the two didn't match and React threw a hydration error
  // (recent.length > 0 renders an extra "Recently Viewed" block). The real
  // list is loaded right after mount instead, mirroring the same fix
  // applied to the cart/build drafts elsewhere in this codebase.
  const [recent, setRecent] = useState<RecentColourEntry[]>([]);

  useEffect(() => {
    // One-time hydration from localStorage on mount — not a derived/
    // cascading update, so react-hooks/set-state-in-effect's general
    // guidance doesn't apply here (see PaymentSuccessClient for the same
    // pattern/rationale).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(readJson<RecentColourEntry[]>(RECENT_KEY, []));
  }, []);

  const addRecent = useCallback((entry: RecentColourEntry) => {
    setRecent((prev) => {
      const deduped = prev.filter((c) => !(c.type === entry.type && c.name === entry.name));
      const next = [entry, ...deduped].slice(0, MAX_RECENT);
      writeJson(RECENT_KEY, next);
      return next;
    });
  }, []);

  return { recent, addRecent };
}

/** Tracks starred Pantone codes so a buyer building multiple products can
 *  jump straight back to a colour they've already dye-matched before. */
export function useFavouritePantones() {
  // Same deterministic-empty-then-hydrate pattern as useRecentColours above
  // — favourites also reorders the rendered Pantone grid, so hydrating it
  // from localStorage during the initial render caused the same mismatch.
  const [favourites, setFavourites] = useState<string[]>([]);

  useEffect(() => {
    // One-time hydration from localStorage on mount — see useRecentColours
    // above for the same rationale.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavourites(readJson<string[]>(FAVOURITES_KEY, []));
  }, []);

  const toggleFavourite = useCallback((code: string) => {
    setFavourites((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      writeJson(FAVOURITES_KEY, next);
      return next;
    });
  }, []);

  return { favourites, toggleFavourite };
}