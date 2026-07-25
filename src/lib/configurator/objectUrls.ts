import type { Artwork, NeckLabel } from "@/lib/configurator/types/configurator";

const UPLOAD_DB_NAME = "mf-configurator-uploads";
const UPLOAD_STORE_NAME = "files";
const UPLOAD_DB_VERSION = 1;

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

async function readUploadedFile(key: string): Promise<Blob | undefined> {
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
