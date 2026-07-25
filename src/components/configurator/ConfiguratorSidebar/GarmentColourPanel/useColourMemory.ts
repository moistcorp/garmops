"use client";

import { useCallback, useState } from "react";

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
  const [recent, setRecent] = useState<RecentColourEntry[]>(() =>
    readJson<RecentColourEntry[]>(RECENT_KEY, [])
  );

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
  const [favourites, setFavourites] = useState<string[]>(() =>
    readJson<string[]>(FAVOURITES_KEY, [])
  );

  const toggleFavourite = useCallback((code: string) => {
    setFavourites((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      writeJson(FAVOURITES_KEY, next);
      return next;
    });
  }, []);

  return { favourites, toggleFavourite };
}
