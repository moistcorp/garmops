import type { Artwork, NeckLabel } from "@/lib/configurator/types/configurator";

const UPLOAD_DB_NAME = "mf-configurator-uploads";
const UPLOAD_STORE_NAME = "files";
const UPLOAD_DB_VERSION = 1;
let cleanupTimer: number | null = null;

function openUploadDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }

    const request = indexedDB.open(UPLOAD_DB_NAME, UPLOAD_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(UPLOAD_STORE_NAME)) {
        db.createObjectStore(UPLOAD_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open upload storage"));
  });
}

export async function persistUploadedFile(file: File): Promise<string | undefined> {
  try {
    const db = await openUploadDatabase();
    const key =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(UPLOAD_STORE_NAME, "readwrite");
      transaction.objectStore(UPLOAD_STORE_NAME).put(file, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Could not save uploaded file"));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Saving uploaded file was aborted"));
    });
    db.close();
    return key;
  } catch {
    return undefined;
  }
}

export async function readUploadedFile(key: string): Promise<Blob | undefined> {
  try {
    const db = await openUploadDatabase();
    const result = await new Promise<Blob | undefined>((resolve, reject) => {
      const request = db
        .transaction(UPLOAD_STORE_NAME, "readonly")
        .objectStore(UPLOAD_STORE_NAME)
        .get(key);
      request.onsuccess = () =>
        resolve(request.result instanceof Blob ? request.result : undefined);
      request.onerror = () =>
        reject(request.error ?? new Error("Could not read uploaded file"));
    });
    db.close();
    return result;
  } catch {
    return undefined;
  }
}

async function listUploadedFileKeys(): Promise<string[]> {
  try {
    const db = await openUploadDatabase();
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = db
        .transaction(UPLOAD_STORE_NAME, "readonly")
        .objectStore(UPLOAD_STORE_NAME)
        .getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Could not list uploaded files"));
    });
    db.close();
    return keys.filter((key): key is string => typeof key === "string");
  } catch {
    return [];
  }
}

async function deleteUploadedFiles(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  try {
    const db = await openUploadDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(UPLOAD_STORE_NAME, "readwrite");
      const store = transaction.objectStore(UPLOAD_STORE_NAME);
      keys.forEach((key) => store.delete(key));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Could not clean uploaded files"));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Upload cleanup was aborted"));
    });
    db.close();
  } catch {
    // Cleanup is best-effort. A failed cleanup must never block the builder.
  }
}

function collectFileKeys(value: unknown, output: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectFileKeys(entry, output));
    return;
  }
  if (!value || typeof value !== "object") return;

  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    if (key === "fileKey" && typeof entry === "string" && entry) {
      output.add(entry);
      return;
    }
    collectFileKeys(entry, output);
  });
}

function referencedUploadKeys(): Set<string> {
  const referenced = new Set<string>();
  if (typeof window === "undefined") return referenced;

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const storageKey = window.localStorage.key(index);
      if (!storageKey?.startsWith("mf_configurator_")) continue;
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) continue;
      try {
        collectFileKeys(JSON.parse(raw), referenced);
      } catch {
        // Ignore malformed/legacy entries; normal draft readers handle them.
      }
    }
  } catch {
    // localStorage may be unavailable in private/restricted browsing modes.
  }

  return referenced;
}

/** Removes IndexedDB uploads that are no longer referenced by any saved
 * configurator build or cart. Referenced files are never deleted, including
 * files still attached to an older cart item while that item is being edited. */
export async function cleanupUnreferencedUploadedFiles(): Promise<void> {
  if (typeof window === "undefined") return;
  const [storedKeys, referenced] = await Promise.all([
    listUploadedFileKeys(),
    Promise.resolve(referencedUploadKeys()),
  ]);
  await deleteUploadedFiles(storedKeys.filter((key) => !referenced.has(key)));
}

/** Debounces cleanup so localStorage autosave has time to persist the newest
 * file references before unreferenced IndexedDB records are removed. */
export function scheduleUploadCleanup(delayMs = 1800): void {
  if (typeof window === "undefined") return;
  if (cleanupTimer) window.clearTimeout(cleanupTimer);
  cleanupTimer = window.setTimeout(() => {
    cleanupTimer = null;
    void cleanupUnreferencedUploadedFiles();
  }, delayMs);
}

async function blobUrlStillWorks(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function restoreUploadUrl(
  fileUrl: string,
  fileKey?: string
): Promise<string | undefined> {
  if (!isObjectUrl(fileUrl)) return fileUrl;
  if (fileKey) {
    const stored = await readUploadedFile(fileKey);
    if (stored) return URL.createObjectURL(stored);
  }
  return (await blobUrlStillWorks(fileUrl)) ? fileUrl : undefined;
}

/**
 * Recreates document-scoped blob URLs after a reload. Legacy drafts that only
 * contain an expired blob URL are cleared instead of pretending the upload is
 * still available.
 */
export async function restoreConfigurationUploads(
  artwork: Artwork,
  neckLabel?: Partial<NeckLabel>
): Promise<{ artwork: Artwork; neckLabel?: NeckLabel }> {
  const [frontUrl, backUrl, neckLabelUrl] = await Promise.all([
    artwork.front
      ? restoreUploadUrl(artwork.front.fileUrl, artwork.front.fileKey)
      : undefined,
    artwork.back
      ? restoreUploadUrl(artwork.back.fileUrl, artwork.back.fileKey)
      : undefined,
    neckLabel?.fileUrl
      ? restoreUploadUrl(neckLabel.fileUrl, neckLabel.fileKey)
      : undefined,
  ]);

  return {
    artwork: {
      front:
        artwork.front && frontUrl
          ? { ...artwork.front, fileUrl: frontUrl }
          : undefined,
      back:
        artwork.back && backUrl
          ? { ...artwork.back, fileUrl: backUrl }
          : undefined,
    },
    neckLabel:
      neckLabel?.fileUrl && neckLabelUrl
        ? ({ ...neckLabel, fileUrl: neckLabelUrl } as NeckLabel)
        : undefined,
  };
}

export function isObjectUrl(url?: string): url is string {
  return typeof url === "string" && url.startsWith("blob:");
}

export function revokeObjectUrl(url?: string): void {
  if (isObjectUrl(url)) {
    URL.revokeObjectURL(url);
  }
}

export function revokeArtworkObjectUrls(artwork?: Artwork): void {
  revokeObjectUrl(artwork?.front?.fileUrl);
  revokeObjectUrl(artwork?.back?.fileUrl);
}

export function revokeNeckLabelObjectUrl(neckLabel?: Partial<NeckLabel>): void {
  revokeObjectUrl(neckLabel?.fileUrl);
}
