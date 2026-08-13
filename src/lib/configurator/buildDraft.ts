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
import { isReflectiveColourKey } from "./reflectiveColours";

const STORAGE_PREFIX = "mf_configurator_build:";
const DRAFT_VERSION = 1;
const STEP_IDS = new Set(["garment-colour", "artwork", "neck-label"]);
const ARTWORK_FILE_TYPES = new Set(["jpg", "png", "pdf", "svg", "ai"]);
const ARTWORK_TECHNIQUES = new Set([
  "screen_print",
  "dtf",
  "reflective_print",
]);
const PRINT_AREAS = new Set(["XS", "S", "M", "L", "XL", "XXL"]);
const NECK_LABEL_FILE_TYPES = new Set(["svg", "ai"]);
const NECK_LABEL_DIMENSIONS = new Set(["50x18", "60x20", "65x15", "45x45"]);
const NECK_LABEL_POSITIONS = new Set(["below_neck_tape", "on_neck_tape"]);
const NECK_LABEL_STITCHES = new Set(["2_side", "4_corner", "2_corner"]);

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
    (value.reflectiveColour === undefined ||
      isReflectiveColourKey(value.reflectiveColour)) &&
    finiteNumber(value.width) &&
    finiteNumber(value.height) &&
    finiteNumber(value.fromNeck) &&
    finiteNumber(value.fromCenter) &&
    PRINT_AREAS.has(String(value.printArea)) &&
    isRecord(value.guidelines) &&
    typeof value.guidelines.maximumArea === "boolean" &&
    typeof value.guidelines.leftChest === "boolean" &&
    typeof value.confirmed === "boolean"
    && (value.previewUrl === undefined || typeof value.previewUrl === "string")
    && (value.previewFileId === undefined || typeof value.previewFileId === "string")
    && (value.previewFileKey === undefined || typeof value.previewFileKey === "string")
    && (value.previewKind === undefined || value.previewKind === "vector" || value.previewKind === "raster")
    && (value.processingStatus === undefined || ["idle", "analysing", "processing", "ready", "needs_review", "failed"].includes(String(value.processingStatus)))
    && (value.sourceIsVector === undefined || typeof value.sourceIsVector === "boolean")
    && (value.detectedColorCount === undefined || finiteNumber(value.detectedColorCount))
    && (value.isContinuousTone === undefined || typeof value.isContinuousTone === "boolean")
    && (value.backgroundRemoved === undefined || typeof value.backgroundRemoved === "boolean")
    && (value.backgroundRemovalConfidence === undefined || finiteNumber(value.backgroundRemovalConfidence))
    && (value.processingWarnings === undefined || (Array.isArray(value.processingWarnings) && value.processingWarnings.every((warning) => typeof warning === "string")))
    && (value.processingErrorCode === undefined || typeof value.processingErrorCode === "string")
  );
}

function isNeckLabel(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    (value.labelType === undefined || value.labelType === "standard-size" || value.labelType === "custom") &&
    (value.fileUrl === undefined || typeof value.fileUrl === "string") &&
    (value.fileKey === undefined || typeof value.fileKey === "string") &&
    (value.fileName === undefined || typeof value.fileName === "string") &&
    (value.fileType === undefined || NECK_LABEL_FILE_TYPES.has(String(value.fileType))) &&
    (value.dimensions === undefined || NECK_LABEL_DIMENSIONS.has(String(value.dimensions))) &&
    (value.position === undefined || NECK_LABEL_POSITIONS.has(String(value.position))) &&
    (value.stitch === undefined || NECK_LABEL_STITCHES.has(String(value.stitch))) &&
    (value.confirmed === undefined || typeof value.confirmed === "boolean")
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

function normalizeBuildDraft(input: unknown): BuildDraft | null {
  const parsed = input as Partial<BuildDraft>;
  if (
    !isRecord(parsed) ||
    parsed.version !== DRAFT_VERSION ||
    !isRecord(parsed.colour) ||
    (parsed.colour.type !== "signature" &&
      parsed.colour.type !== "custom_dye") ||
    typeof parsed.colour.name !== "string" ||
    typeof parsed.colour.hex !== "string" ||
    (parsed.colour.id !== undefined && typeof parsed.colour.id !== "string") ||
    typeof parsed.colour.confirmed !== "boolean" ||
    !isRecord(parsed.artwork) ||
    (parsed.artwork.front !== undefined &&
      !isArtworkSide(parsed.artwork.front)) ||
    (parsed.artwork.back !== undefined &&
      !isArtworkSide(parsed.artwork.back)) ||
    (parsed.neckLabel !== undefined && !isNeckLabel(parsed.neckLabel)) ||
    !Array.isArray(parsed.steps) ||
    !parsed.steps.every(
      (step) =>
        isRecord(step) &&
        STEP_IDS.has(String(step.id)) &&
        typeof step.title === "string" &&
        (step.summary === null || typeof step.summary === "string") &&
        typeof step.confirmed === "boolean" &&
        (step.skipped === undefined || typeof step.skipped === "boolean")
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
}

/**
 * Central schema migration boundary for local and cloud configurator drafts.
 * Future versions add explicit transforms here; unknown future data is never
 * overwritten so it remains recoverable in the browser.
 */
export function migrateConfiguratorDraft(
  input: unknown,
  fromVersion: number,
  toVersion = DRAFT_VERSION
): BuildDraft | null {
  if (
    !Number.isInteger(fromVersion) ||
    !Number.isInteger(toVersion) ||
    fromVersion <= 0 ||
    fromVersion > DRAFT_VERSION ||
    toVersion !== DRAFT_VERSION
  ) {
    return null;
  }
  if (fromVersion === DRAFT_VERSION) return normalizeBuildDraft(input);
  return null;
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

    const parsed = JSON.parse(raw) as { version?: unknown };
    return migrateConfiguratorDraft(parsed, Number(parsed.version));
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
): boolean {
  if (typeof window === "undefined") return false;

  try {
    const payload: BuildDraft = {
      ...draft,
      version: DRAFT_VERSION,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(storageKey(configId), JSON.stringify(payload));
    scheduleUploadCleanup();
    return true;
  } catch {
    // The caller surfaces a non-blocking recovery message. The active in-memory
    // configuration remains usable even when browser storage is unavailable.
    return false;
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
  const hasNeckLabel = Boolean(
    draft.neckLabel?.fileUrl || draft.neckLabel?.fileId
  );
  const hasCompletedStep = draft.steps.some((step) => step.confirmed || step.skipped);
  return hasColourChoice || hasArtwork || hasNeckLabel || hasCompletedStep;
}
