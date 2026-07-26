// src/lib/configurator/buildDraft.ts
//
// Autosave for the /configurator/build/[configId] screen. Distinct from
// cart/cartDraft.ts, which only persists a configuration once the customer
// clicks the final "Add To Cart" CTA — this saves the in-progress state
// (colour, artwork, neck label, step confirmations, quantity) on every
// change, so a refresh, accidental tab close, or a customer coming back
// later doesn't lose an upload or a set of selections that were never
// confirmed.

import type { GarmentColour, Artwork, NeckLabel } from "./types/configurator";
import type { AccordionStepState } from "@/components/configurator/ConfiguratorSidebar/ConfiguratorSidebar";
import { scheduleUploadCleanup } from "./objectUrls";

const STORAGE_PREFIX = "mf_configurator_build:";
const DRAFT_VERSION = 1;
const STEP_IDS = new Set(["garment-colour", "artwork", "neck-label"]);
const ARTWORK_FILE_TYPES = new Set(["jpg", "png", "svg", "ai"]);
const ARTWORK_TECHNIQUES = new Set([
  "screen_print",
  "dtg",
  "dtf",
  "reflective_heat_transfer",
  "puff_print",
  "embroidery",
]);
const PRINT_AREAS = new Set(["XS", "S", "M", "L", "XL", "XXL"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isArtworkSide(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.fileUrl === "string" &&
    ARTWORK_FILE_TYPES.has(String(value.fileType)) &&
    (value.technique === undefined ||
      ARTWORK_TECHNIQUES.has(String(value.technique))) &&
    finiteNumber(value.width) &&
    finiteNumber(value.height) &&
    finiteNumber(value.fromNeck) &&
    finiteNumber(value.fromCenter) &&
    PRINT_AREAS.has(String(value.printArea)) &&
    isRecord(value.guidelines) &&
    typeof value.guidelines.maximumArea === "boolean" &&
    typeof value.guidelines.leftChest === "boolean" &&
    typeof value.confirmed === "boolean"
  );
}

export interface BuildDraft {
  version: number;
  savedAt: string; // ISO timestamp, mainly for future "resume where you left off" messaging
  colour: GarmentColour;
  artwork: Artwork;
  neckLabel: NeckLabel;
  steps: AccordionStepState[];
  quantity: number;
}

function storageKey(configId: string): string {
  return `${STORAGE_PREFIX}${configId}`;
}

/**
 * Reads a saved draft for this configId, if one exists and looks well-formed.
 * Returns null on first visit, in SSR, or if parsing/shape checks fail —
 * callers should fall back to their own defaults in all of those cases.
 */
export function readBuildDraft(configId: string): BuildDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey(configId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<BuildDraft>;
    if (
      !isRecord(parsed) ||
      parsed.version !== DRAFT_VERSION ||
      !isRecord(parsed.colour) ||
      (parsed.colour.type !== "signature" &&
        parsed.colour.type !== "custom_dye") ||
      typeof parsed.colour.name !== "string" ||
      typeof parsed.colour.hex !== "string" ||
      typeof parsed.colour.confirmed !== "boolean" ||
      !isRecord(parsed.artwork) ||
      (parsed.artwork.front !== undefined &&
        !isArtworkSide(parsed.artwork.front)) ||
      (parsed.artwork.back !== undefined &&
        !isArtworkSide(parsed.artwork.back)) ||
      !Array.isArray(parsed.steps) ||
      !parsed.steps.every(
        (step) =>
          isRecord(step) &&
          STEP_IDS.has(String(step.id)) &&
          typeof step.title === "string" &&
          (step.summary === null || typeof step.summary === "string") &&
          typeof step.confirmed === "boolean"
      )
    ) {
      return null;
    }

    const quantity =
      finiteNumber(parsed.quantity) && parsed.quantity > 0
        ? Math.floor(parsed.quantity)
        : 50;

    return {
      version: DRAFT_VERSION,
      savedAt: parsed.savedAt ?? new Date().toISOString(),
      colour: parsed.colour as GarmentColour,
      artwork: parsed.artwork as Artwork,
      neckLabel: (parsed.neckLabel ?? {}) as NeckLabel,
      steps: parsed.steps as AccordionStepState[],
      quantity,
    };
  } catch {
    // Corrupted/unparseable draft — treat as if none exists rather than
    // throwing and blocking the configurator from loading.
    return null;
  }
}

/** Writes (overwrites) the draft for this configId. Fails silently if
 *  localStorage is unavailable (SSR, private browsing quota, etc.) — losing
 *  autosave is preferable to crashing the configurator. */
export function writeBuildDraft(
  configId: string,
  draft: Omit<BuildDraft, "version" | "savedAt">
): void {
  if (typeof window === "undefined") return;

  try {
    const payload: BuildDraft = {
      ...draft,
      version: DRAFT_VERSION,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(storageKey(configId), JSON.stringify(payload));
    scheduleUploadCleanup();
  } catch {
    // Ignore quota/availability errors — autosave is a convenience, not a
    // requirement for the configurator to keep working.
  }
}

/** Clears the in-progress draft, e.g. once its contents have been handed off
 *  to the cart via upsertConfiguredCartItem so a stale draft doesn't resurface. */
export function clearBuildDraft(configId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(configId));
    scheduleUploadCleanup();
  } catch {
    // No-op — nothing meaningful to recover from here.
  }
}

/** True if a saved draft has any real content worth restoring (as opposed to
 *  an all-defaults draft written before the customer touched anything). */
export function hasMeaningfulDraft(draft: BuildDraft | null): boolean {
  if (!draft) return false;
  const hasColourChoice = draft.colour.confirmed || draft.colour.type === "custom_dye";
  const hasArtwork = Boolean(draft.artwork.front || draft.artwork.back);
  const hasNeckLabel = Boolean(draft.neckLabel?.fileUrl);
  const hasConfirmedStep = draft.steps.some((step) => step.confirmed);
  return hasColourChoice || hasArtwork || hasNeckLabel || hasConfirmedStep;
}
