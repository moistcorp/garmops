"use client";

import type { BuildDraft } from "@/lib/configurator/buildDraft";
import { readUploadedFile } from "@/lib/configurator/objectUrls";
import type {
  Artwork,
  ArtworkSide,
  NeckLabel,
} from "@/lib/configurator/types/configurator";
import type { CloudDesignSnapshot } from "@/lib/designs/schema";

const CLOUD_LINK_PREFIX = "mf_configurator_cloud:";
const PENDING_IMPORT_PREFIX = "mf_configurator_cloud_pending:";
const ESTIMATE_LINK_PREFIX = "garmops:estimate-for-design:";

export type CloudDesignLink = {
  designId: string;
  draftRevision: number;
  currentVersion: number;
  lastSavedAt: string;
  uploadFileIds: Record<string, string>;
  needsImportVersion?: boolean;
};

export type CloudSaveConflict = {
  draftRevision: number;
  lastSavedAt: string;
  snapshot: CloudDesignSnapshot;
  title: string;
  status: string;
  currentVersion: number;
};

export type CloudSaveResult =
  | { ok: true; link: CloudDesignLink; uploadedDraft: BuildDraft }
  | { ok: false; kind: "unauthorized" | "unavailable" | "error"; message: string }
  | { ok: false; kind: "conflict"; conflict: CloudSaveConflict };

type UploadReference = {
  fileKey: string;
  filename: string;
  contentType: string;
};

function cloudLinkKey(configId: string): string {
  return `${CLOUD_LINK_PREFIX}${configId}`;
}

function pendingImportKey(operationKey: string): string {
  return `${PENDING_IMPORT_PREFIX}${operationKey}`;
}

/** Retained for configurator deep links; checkout no longer consumes estimates. */
export function writeEstimateForDesign(designId: string, estimateId: string): void {
  try { window.localStorage.setItem(`${ESTIMATE_LINK_PREFIX}${designId}`, estimateId); } catch { /* browser storage is optional */ }
}


function replaySafeImportId(operationKey: string): string {
  const storageKey = pendingImportKey(operationKey);
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function clearPendingImportId(operationKey: string): void {
  try {
    window.localStorage.removeItem(pendingImportKey(operationKey));
  } catch {
    // A retained operation ID is safe and resolves to the same server row.
  }
}

export function readCloudDesignLink(configId: string): CloudDesignLink | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cloudLinkKey(configId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CloudDesignLink>;
    if (
      typeof parsed.designId !== "string" ||
      !Number.isInteger(parsed.draftRevision) ||
      !Number.isInteger(parsed.currentVersion) ||
      typeof parsed.lastSavedAt !== "string" ||
      !parsed.uploadFileIds ||
      typeof parsed.uploadFileIds !== "object"
    ) {
      return null;
    }
    return parsed as CloudDesignLink;
  } catch {
    return null;
  }
}

export function writeCloudDesignLink(
  configId: string,
  link: CloudDesignLink,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cloudLinkKey(configId), JSON.stringify(link));
  } catch {
    // The browser draft remains authoritative until a later successful write.
  }
}

function safeCloudAssetUrl(fileUrl?: string): string | undefined {
  if (!fileUrl) return undefined;
  return fileUrl.startsWith("/") || fileUrl.startsWith("https://")
    ? fileUrl
    : undefined;
}

function cloudArtworkSide(
  side: ArtworkSide,
  uploadFileIds: Record<string, string>,
): CloudDesignSnapshot["configuration"]["artwork"]["front"] {
  const fileId =
    side.fileId ?? (side.fileKey ? uploadFileIds[side.fileKey] : undefined);
  const fileUrl = safeCloudAssetUrl(side.fileUrl);
  return {
    ...(fileUrl ? { fileUrl } : {}),
    ...(fileId ? { fileId } : {}),
    ...(!fileUrl && !fileId ? { pendingUpload: true as const } : {}),
    ...(side.fileName ? { fileName: side.fileName } : {}),
    fileType: side.fileType,
    vectorized: side.vectorized,
    ...(side.technique ? { technique: side.technique } : {}),
    width: side.width,
    height: side.height,
    fromNeck: side.fromNeck,
    fromCenter: side.fromCenter,
    printArea: side.printArea,
    guidelines: { ...side.guidelines },
    confirmed: side.confirmed,
    ...(side.pixelWidth ? { pixelWidth: side.pixelWidth } : {}),
    ...(side.pixelHeight ? { pixelHeight: side.pixelHeight } : {}),
    ...(side.hasTransparency !== undefined
      ? { hasTransparency: side.hasTransparency }
      : {}),
    ...(side.averageLuminance !== undefined
      ? { averageLuminance: side.averageLuminance }
      : {}),
  };
}

function cloudNeckLabel(
  label: NeckLabel,
  uploadFileIds: Record<string, string>,
): CloudDesignSnapshot["configuration"]["neckLabel"] {
  const fileId =
    label.fileId ?? (label.fileKey ? uploadFileIds[label.fileKey] : undefined);
  const fileUrl = safeCloudAssetUrl(label.fileUrl);
  return {
    ...(fileUrl ? { fileUrl } : {}),
    ...(fileId ? { fileId } : {}),
    ...(!fileUrl && !fileId ? { pendingUpload: true as const } : {}),
    ...(label.fileName ? { fileName: label.fileName } : {}),
    ...(label.fileType ? { fileType: label.fileType } : {}),
    ...(label.source ? { source: label.source } : {}),
    dimensions: label.dimensions,
    position: label.position,
    ...(label.stitch ? { stitch: label.stitch } : {}),
    confirmed: label.confirmed,
  };
}

export function buildCloudDesignSnapshot(
  configId: string,
  draft: BuildDraft,
  uploadFileIds: Record<string, string> = {},
): CloudDesignSnapshot {
  return {
    schemaVersion: 1,
    kind: "configurator_build",
    configId,
    savedAt: draft.savedAt,
    configuration: {
      colour: { ...draft.colour },
      artwork: {
        ...(draft.artwork.front
          ? { front: cloudArtworkSide(draft.artwork.front, uploadFileIds) }
          : {}),
        ...(draft.artwork.back
          ? { back: cloudArtworkSide(draft.artwork.back, uploadFileIds) }
          : {}),
      },
      ...(draft.neckLabel?.fileUrl || draft.neckLabel?.fileId
        ? { neckLabel: cloudNeckLabel(draft.neckLabel, uploadFileIds) }
        : {}),
      steps: draft.steps.map((step) => ({ ...step })),
      quantity: draft.quantity,
    },
  };
}

function contentTypeFor(filename: string, fallback?: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "svg") return "image/svg+xml";
  if (extension === "ai") return "application/postscript";
  return fallback || "application/octet-stream";
}

function uploadReferences(draft: BuildDraft): UploadReference[] {
  const references: UploadReference[] = [];
  const add = (
    value: Pick<ArtworkSide, "fileKey" | "fileName" | "fileType"> | NeckLabel,
    fallbackName: string,
  ) => {
    if (!value.fileKey) return;
    const filename = value.fileName || `${fallbackName}.${value.fileType || "svg"}`;
    references.push({
      fileKey: value.fileKey,
      filename,
      contentType: contentTypeFor(filename),
    });
  };
  if (draft.artwork.front) add(draft.artwork.front, "front-artwork");
  if (draft.artwork.back) add(draft.artwork.back, "back-artwork");
  if (draft.neckLabel?.fileUrl) add(draft.neckLabel, "neck-label");
  return references;
}

async function uploadReference(
  designId: string,
  reference: UploadReference,
): Promise<string> {
  const stored = await readUploadedFile(reference.fileKey);
  if (!stored) throw new Error(`Re-upload ${reference.filename} to save it`);

  const contentType = contentTypeFor(reference.filename, stored.type);
  const slotResponse = await fetch("/api/uploads/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      designProjectId: designId,
      kind: "customer_artwork",
      visibility: "customer",
      filename: reference.filename,
      contentType,
      byteSize: stored.size,
    }),
  });
  if (!slotResponse.ok) throw new Error("Artwork upload could not be started");
  const slot = (await slotResponse.json()) as {
    fileId: string;
    upload: {
      url: string;
      method: "PUT";
      headers: Record<string, string>;
    };
    finalizeUrl: string;
  };

  const uploadResponse = await fetch(slot.upload.url, {
    method: slot.upload.method,
    headers: slot.upload.headers,
    body: stored,
  });
  if (!uploadResponse.ok) throw new Error("Artwork upload did not complete");

  const finalizeResponse = await fetch(slot.finalizeUrl, { method: "POST" });
  if (!finalizeResponse.ok) {
    throw new Error("Artwork upload could not be verified");
  }
  return slot.fileId;
}

async function ensureCloudUploads(
  configId: string,
  draft: BuildDraft,
  link: CloudDesignLink,
): Promise<CloudDesignLink> {
  const nextLink: CloudDesignLink = {
    ...link,
    uploadFileIds: { ...link.uploadFileIds },
  };
  for (const reference of uploadReferences(draft)) {
    if (nextLink.uploadFileIds[reference.fileKey]) continue;
    nextLink.uploadFileIds[reference.fileKey] = await uploadReference(
      link.designId,
      reference,
    );
    writeCloudDesignLink(configId, nextLink);
  }
  return nextLink;
}

async function responseFailure(response: Response): Promise<CloudSaveResult> {
  if (response.status === 401) {
    return {
      ok: false,
      kind: "unauthorized",
      message: "Sign in to save this design to your account",
    };
  }
  if (response.status === 503) {
    return {
      ok: false,
      kind: "unavailable",
      message: "Cloud save is temporarily unavailable",
    };
  }
  if (response.status === 409) {
    const body = (await response.json()) as { conflict?: CloudSaveConflict };
    if (body.conflict?.snapshot) {
      return { ok: false, kind: "conflict", conflict: body.conflict };
    }
  }
  return {
    ok: false,
    kind: "error",
    message: "This browser draft is safe, but cloud save did not complete",
  };
}

function draftWithFileIds(
  draft: BuildDraft,
  uploadFileIds: Record<string, string>,
): BuildDraft {
  const artworkSide = (side?: ArtworkSide): ArtworkSide | undefined =>
    side
      ? {
          ...side,
          fileId:
            side.fileId ??
            (side.fileKey ? uploadFileIds[side.fileKey] : undefined),
        }
      : undefined;
  return {
    ...draft,
    artwork: {
      front: artworkSide(draft.artwork.front),
      back: artworkSide(draft.artwork.back),
    },
    neckLabel: draft.neckLabel?.fileUrl
      ? {
          ...draft.neckLabel,
          fileId:
            draft.neckLabel.fileId ??
            (draft.neckLabel.fileKey
              ? uploadFileIds[draft.neckLabel.fileKey]
              : undefined),
        }
      : draft.neckLabel,
  };
}

export async function saveBuildDraftToCloud(input: {
  configId: string;
  storageKey?: string;
  productName: string;
  draft: BuildDraft;
  existingLink?: CloudDesignLink | null;
  forceRevision?: number;
  createCopy?: boolean;
  operationKey?: string;
  title?: string;
}): Promise<CloudSaveResult> {
  const storageKey = input.storageKey ?? input.configId;
  let link = input.createCopy
    ? null
    : input.existingLink ?? readCloudDesignLink(storageKey);

  if (!link) {
    const operationKey = input.operationKey ?? storageKey;
    const importId = replaySafeImportId(operationKey);
    const createResponse = await fetch("/api/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.title?.trim() || `${input.productName} design`,
        schemaVersion: 1,
        snapshot: buildCloudDesignSnapshot(input.configId, input.draft),
        pricingSnapshot: {
          configId: input.configId,
          quantity: input.draft.quantity,
        },
        source: "browser_import",
        clientImportId: importId,
      }),
    });
    if (!createResponse.ok) return responseFailure(createResponse);
    const body = (await createResponse.json()) as {
      design: {
        id: string;
        draftRevision: number;
        currentVersion: number;
        lastSavedAt: string;
      };
    };
    link = {
      designId: body.design.id,
      draftRevision: body.design.draftRevision,
      currentVersion: body.design.currentVersion,
      lastSavedAt: body.design.lastSavedAt,
      uploadFileIds: {},
      needsImportVersion: uploadReferences(input.draft).length > 0,
    };
    writeCloudDesignLink(storageKey, link);
    clearPendingImportId(operationKey);
  }

  try {
    link = await ensureCloudUploads(input.configId, input.draft, link);
  } catch (error) {
    writeCloudDesignLink(storageKey, link);
    return {
      ok: false,
      kind: "error",
      message:
        error instanceof Error
          ? error.message
          : "Artwork could not be uploaded",
    };
  }

  const uploadedDraft = draftWithFileIds(input.draft, link.uploadFileIds);
  const saveResponse = await fetch(
    `/api/designs/${encodeURIComponent(link.designId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedRevision: input.forceRevision ?? link.draftRevision,
        schemaVersion: 1,
        snapshot: buildCloudDesignSnapshot(
          input.configId,
          uploadedDraft,
          link.uploadFileIds,
        ),
        pricingSnapshot: {
          configId: input.configId,
          quantity: uploadedDraft.quantity,
        },
      }),
    },
  );
  if (!saveResponse.ok) return responseFailure(saveResponse);

  const savedBody = (await saveResponse.json()) as {
    design: {
      draftRevision: number;
      currentVersion: number;
      lastSavedAt: string;
    };
  };
  link = {
    ...link,
    draftRevision: savedBody.design.draftRevision,
    currentVersion: savedBody.design.currentVersion,
    lastSavedAt: savedBody.design.lastSavedAt,
  };

  if (link.needsImportVersion) {
    const versionResponse = await fetch(
      `/api/designs/${encodeURIComponent(link.designId)}/versions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision: link.draftRevision }),
      },
    );
    if (versionResponse.ok) {
      const versionBody = (await versionResponse.json()) as {
        version: {
          draftRevision: number;
          number: number;
          createdAt: string;
        };
      };
      link = {
        ...link,
        draftRevision: versionBody.version.draftRevision,
        currentVersion: versionBody.version.number,
        lastSavedAt: versionBody.version.createdAt,
        needsImportVersion: false,
      };
    }
  }

  writeCloudDesignLink(storageKey, link);
  return { ok: true, link, uploadedDraft };
}

export async function loadCloudDesign(
  designId: string,
): Promise<
  | {
      ok: true;
      design: {
        id: string;
        title: string;
        draft_revision: number;
        current_version: number;
        last_saved_at: string;
        draft_snapshot: CloudDesignSnapshot;
      };
    }
  | { ok: false; status: number }
> {
  let response: Response;
  try {
    response = await fetch(`/api/designs/${encodeURIComponent(designId)}`, {
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0 };
  }
  if (!response.ok) return { ok: false, status: response.status };
  const body = (await response.json()) as {
    design: {
      id: string;
      title: string;
      draft_revision: number;
      current_version: number;
      last_saved_at: string;
      draft_snapshot: CloudDesignSnapshot;
    };
  };
  return { ok: true, design: body.design };
}

async function resolvedCloudFileUrl(fileId?: string): Promise<string> {
  if (!fileId) return "";
  try {
    const response = await fetch(
      `/api/files/${encodeURIComponent(fileId)}/download-url`,
      { method: "POST" },
    );
    if (!response.ok) return "";
    const body = (await response.json()) as { download?: { url?: string } };
    return body.download?.url ?? "";
  } catch {
    return "";
  }
}

export async function cloudSnapshotToBuildDraft(
  snapshot: CloudDesignSnapshot,
): Promise<BuildDraft> {
  const configuration = snapshot.configuration;
  const [frontUrl, backUrl, neckUrl] = await Promise.all([
    configuration.artwork.front?.fileUrl
      ? Promise.resolve(configuration.artwork.front.fileUrl)
      : resolvedCloudFileUrl(configuration.artwork.front?.fileId),
    configuration.artwork.back?.fileUrl
      ? Promise.resolve(configuration.artwork.back.fileUrl)
      : resolvedCloudFileUrl(configuration.artwork.back?.fileId),
    configuration.neckLabel?.fileUrl
      ? Promise.resolve(configuration.neckLabel.fileUrl)
      : resolvedCloudFileUrl(configuration.neckLabel?.fileId),
  ]);
  const artworkSide = (
    side:
      | CloudDesignSnapshot["configuration"]["artwork"]["front"]
      | undefined,
    fileUrl: string,
  ): ArtworkSide | undefined =>
    side
      ? ({
          ...side,
          fileUrl,
          pendingUpload: undefined,
        } as ArtworkSide)
      : undefined;
  const artwork: Artwork = {
    front: artworkSide(configuration.artwork.front, frontUrl),
    back: artworkSide(configuration.artwork.back, backUrl),
  };
  const neckLabel = configuration.neckLabel
    ? ({
        ...configuration.neckLabel,
        fileUrl: neckUrl,
        pendingUpload: undefined,
      } as NeckLabel)
    : ({} as NeckLabel);

  return {
    version: 1,
    savedAt: snapshot.savedAt,
    colour: { ...configuration.colour },
    artwork,
    neckLabel,
    steps: configuration.steps.map((step) => ({ ...step })),
    quantity: configuration.quantity,
  };
}

export async function duplicateDesign(
  designId: string,
  title: string,
): Promise<{ ok: true; designId: string } | { ok: false }> {
  let response: Response;
  try {
    response = await fetch(
      `/api/designs/${encodeURIComponent(designId)}/duplicate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          clientOperationId: crypto.randomUUID(),
        }),
      },
    );
  } catch {
    return { ok: false };
  }
  if (!response.ok) return { ok: false };
  const body = (await response.json()) as { design: { id: string } };
  return { ok: true, designId: body.design.id };
}
