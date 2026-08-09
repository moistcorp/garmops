import { z } from "zod";

export const CLOUD_DESIGN_SCHEMA_VERSION = 1 as const;

const safeAssetUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) =>
      value.startsWith("/") ||
      value.startsWith("https://"),
    "Cloud snapshots cannot contain browser-local URLs",
  );

const colourSchema = z
  .object({
    type: z.enum(["signature", "custom_dye"]),
    name: z.string().max(120),
    hex: z.string().max(40),
    confirmed: z.boolean(),
  })
  .strict();

const artworkSideSchema = z
  .object({
    fileUrl: safeAssetUrl.optional(),
    fileId: z.uuid().optional(),
    pendingUpload: z.literal(true).optional(),
    fileName: z.string().trim().min(1).max(255).optional(),
    fileType: z.enum(["jpg", "png", "pdf", "svg", "ai"]),
    placementPreset: z
      .enum([
        "left-chest",
        "centre-chest",
        "large-front",
        "upper-back",
        "centre-back",
        "large-back",
        "custom",
      ])
      .optional(),
    vectorized: z.boolean(),
    technique: z
      .enum([
        "screen_print",
        "dtf",
        "reflective_print",
      ])
      .optional(),
    width: z.number().finite().min(0).max(200),
    height: z.number().finite().min(0).max(200),
    fromNeck: z.number().finite().min(-200).max(200),
    fromCenter: z.number().finite().min(-200).max(200),
    printArea: z.enum(["XS", "S", "M", "L", "XL", "XXL"]),
    guidelines: z
      .object({
        maximumArea: z.boolean(),
        leftChest: z.boolean(),
      })
      .strict(),
    confirmed: z.boolean(),
    pixelWidth: z.number().finite().positive().max(100_000).optional(),
    pixelHeight: z.number().finite().positive().max(100_000).optional(),
    hasTransparency: z.boolean().optional(),
    averageLuminance: z.number().finite().min(0).max(1).optional(),
  })
  .strict()
  .refine(
    (side) => Boolean(side.fileUrl || side.fileId || side.pendingUpload),
    "Artwork must reference a safe asset or an uploaded file",
  );

const neckLabelSchema = z
  .object({
    labelType: z.enum(["standard-size", "custom"]).optional(),
    fileUrl: safeAssetUrl.optional(),
    fileId: z.uuid().optional(),
    pendingUpload: z.literal(true).optional(),
    fileName: z.string().trim().min(1).max(255).optional(),
    fileType: z.enum(["svg", "ai"]).optional(),
    source: z.enum(["upload", "sample"]).optional(),
    dimensions: z.enum(["50x18", "60x20", "65x15", "45x45"]),
    position: z.enum(["below_neck_tape", "on_neck_tape"]),
    stitch: z.enum(["2_side", "4_corner", "2_corner"]).optional(),
    confirmed: z.boolean(),
  })
  .strict()
  .refine(
    (label) => label.labelType === "standard-size" || Boolean(label.fileUrl || label.fileId || label.pendingUpload),
    "Custom neck label must reference a safe asset or an uploaded file",
  );

const stepSchema = z
  .object({
    id: z.enum(["garment-colour", "artwork", "neck-label"]),
    title: z.string().max(120),
    summary: z.string().max(500).nullable(),
    confirmed: z.boolean(),
    skipped: z.boolean().optional(),
  })
  .strict();

export const cloudDesignSnapshotSchema = z
  .object({
    schemaVersion: z.literal(CLOUD_DESIGN_SCHEMA_VERSION),
    kind: z.literal("configurator_build"),
    configId: z.string().trim().min(1).max(160),
    savedAt: z.iso.datetime({ offset: true }),
    configuration: z
      .object({
        colour: colourSchema,
        artwork: z
          .object({
            front: artworkSideSchema.optional(),
            back: artworkSideSchema.optional(),
            smallestSize: z.enum(["XS", "S", "M", "L", "XL", "XXL"]).optional(),
          })
          .strict(),
        neckLabel: neckLabelSchema.optional(),
        steps: z.array(stepSchema).max(3),
        quantity: z.number().int().positive().max(1_000_000),
      })
      .strict(),
  })
  .strict();

export type CloudDesignSnapshot = z.infer<typeof cloudDesignSnapshotSchema>;

const pricingSnapshotSchema = z
  .record(z.string().min(1).max(120), z.json())
  .optional();

export const createDesignRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    schemaVersion: z.literal(CLOUD_DESIGN_SCHEMA_VERSION),
    snapshot: cloudDesignSnapshotSchema,
    pricingSnapshot: pricingSnapshotSchema,
    source: z.enum(["browser_import", "configurator", "account"]).default(
      "configurator",
    ),
    clientImportId: z.uuid().optional(),
  })
  .strict();

export const saveDesignRequestSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    schemaVersion: z.literal(CLOUD_DESIGN_SCHEMA_VERSION),
    snapshot: cloudDesignSnapshotSchema,
    pricingSnapshot: pricingSnapshotSchema,
    title: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

export const revisionRequestSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
  })
  .strict();

export const duplicateDesignRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    clientOperationId: z.uuid(),
  })
  .strict();
