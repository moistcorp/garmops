import { z } from "zod";

export const browserUploadKinds = [
  "customer_artwork",
  "approval_pdf",
  "proof",
  "qc_photo",
  "packing_list",
  "shipping_label",
  "shipment_document",
] as const;

export type BrowserUploadKind = (typeof browserUploadKinds)[number];
type AllowedFormat = Readonly<{ extensions: ReadonlySet<string>; contentTypes: ReadonlySet<string> }>;
type UploadPolicy = Readonly<{ maximumBytes: number; formats: readonly AllowedFormat[] }>;
const mebibyte = 1024 * 1024;
const format = (extensions: readonly string[], contentTypes: readonly string[]): AllowedFormat => ({ extensions: new Set(extensions), contentTypes: new Set(contentTypes) });

export const uploadPolicies: Readonly<Record<BrowserUploadKind, UploadPolicy>> = {
  customer_artwork: {
    // Direct-to-R2 uploads do not pass through a Next request body. Twenty MB
    // is therefore a safe customer-facing limit while keeping large artwork
    // practical for production review.
    maximumBytes: 20 * mebibyte,
    formats: [
      format(["ai"], ["application/postscript", "application/illustrator", "application/vnd.adobe.illustrator", "application/pdf", "application/octet-stream"]),
      format(["pdf"], ["application/pdf"]),
      format(["svg"], ["image/svg+xml"]),
      format(["png"], ["image/png"]),
      format(["jpg", "jpeg"], ["image/jpeg"]),
    ],
  },
  approval_pdf: { maximumBytes: 20 * mebibyte, formats: [format(["pdf"], ["application/pdf"])] },
  proof: { maximumBytes: 20 * mebibyte, formats: [format(["pdf"], ["application/pdf"]), format(["png"], ["image/png"]), format(["jpg", "jpeg"], ["image/jpeg"])] },
  qc_photo: { maximumBytes: 12 * mebibyte, formats: [format(["png"], ["image/png"]), format(["jpg", "jpeg"], ["image/jpeg"]), format(["webp"], ["image/webp"])] },
  packing_list: { maximumBytes: 15 * mebibyte, formats: [format(["pdf"], ["application/pdf"]), format(["png"], ["image/png"]), format(["jpg", "jpeg"], ["image/jpeg"])] },
  shipping_label: { maximumBytes: 15 * mebibyte, formats: [format(["pdf"], ["application/pdf"]), format(["png"], ["image/png"]), format(["jpg", "jpeg"], ["image/jpeg"])] },
  shipment_document: { maximumBytes: 15 * mebibyte, formats: [format(["pdf"], ["application/pdf"]), format(["png"], ["image/png"]), format(["jpg", "jpeg"], ["image/jpeg"])] },
};

const forbiddenFilenameCharacters = /[\/\\\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
const uploadRequestSchema = z.object({
  orderId: z.uuid().optional(), designProjectId: z.uuid().optional(), replacementForFileId: z.uuid().optional(), kind: z.enum(browserUploadKinds), visibility: z.enum(["customer", "staff_only"]), filename: z.string().trim().min(1).max(255), contentType: z.string().trim().toLowerCase().min(3).max(255), byteSize: z.number().int().positive(), sha256: z.string().trim().toLowerCase().regex(/^[0-9a-f]{64}$/).optional(),
}).strict().superRefine((value, context) => {
  if ([value.orderId, value.designProjectId].filter(Boolean).length !== 1) context.addIssue({ code: "custom", message: "Exactly one upload target is required", path: ["orderId"] });
  if (value.kind === "approval_pdf" && !value.sha256) context.addIssue({ code: "custom", message: "Approval evidence requires SHA-256", path: ["sha256"] });
  if (value.kind === "customer_artwork" && value.visibility !== "customer") context.addIssue({ code: "custom", message: "Customer artwork must remain customer-visible after approval", path: ["visibility"] });
  if (value.replacementForFileId && (!value.orderId || value.kind !== "customer_artwork")) context.addIssue({ code: "custom", message: "Artwork replacements must target an order", path: ["replacementForFileId"] });
});

export type ValidatedUploadRequest = Readonly<{ orderId?: string; designProjectId?: string; replacementForFileId?: string; kind: BrowserUploadKind; visibility: "customer" | "staff_only"; originalFilename: string; safeFilename: string; extension: string; contentType: string; byteSize: number; sha256?: string }>;
export type UploadValidationResult = { ok: true; value: ValidatedUploadRequest } | { ok: false; error: string };
function safeDisplayFilename(filename: string, extension: string): string { const stem = filename.slice(0, -(extension.length + 1)); const safeStem = stem.normalize("NFKC").replace(/[^\p{L}\p{N} ._()-]+/gu, "_").replace(/\s+/g, " ").replace(/^\.+/, "").trim().slice(0, Math.max(1, 240 - extension.length)); return `${safeStem || "download"}.${extension}`; }
export function validateUploadRequest(input: unknown): UploadValidationResult {
  const parsed = uploadRequestSchema.safeParse(input); if (!parsed.success) return { ok: false, error: "Invalid upload request" };
  const filename = parsed.data.filename.normalize("NFKC"); if (filename === "." || filename === ".." || forbiddenFilenameCharacters.test(filename)) return { ok: false, error: "Invalid filename" };
  const separator = filename.lastIndexOf("."); if (separator <= 0 || separator === filename.length - 1) return { ok: false, error: "Filename extension is required" };
  const extension = filename.slice(separator + 1).toLowerCase(); const policy = uploadPolicies[parsed.data.kind]; const allowed = policy.formats.some((candidate) => candidate.extensions.has(extension) && candidate.contentTypes.has(parsed.data.contentType));
  if (!allowed) return { ok: false, error: "File type is not allowed" }; if (parsed.data.byteSize > policy.maximumBytes) return { ok: false, error: "File is too large" };
  return { ok: true, value: Object.freeze({ orderId: parsed.data.orderId, designProjectId: parsed.data.designProjectId, replacementForFileId: parsed.data.replacementForFileId, kind: parsed.data.kind, visibility: parsed.data.visibility, originalFilename: filename, safeFilename: safeDisplayFilename(filename, extension), extension, contentType: parsed.data.contentType, byteSize: parsed.data.byteSize, sha256: parsed.data.sha256 }) };
}
