import { describe, expect, it } from "vitest";

import { migrateConfiguratorDraft } from "../configurator/buildDraft";
import {
  cloudDesignSnapshotSchema,
  createDesignRequestSchema,
} from "./schema";

const validSnapshot = {
  schemaVersion: 1,
  kind: "configurator_build",
  configId: "regular-fit-tee-200gsm",
  savedAt: "2026-07-29T12:00:00.000Z",
  configuration: {
    colour: {
      type: "signature",
      name: "Bright White",
      hex: "#ffffff",
      confirmed: true,
    },
    artwork: {},
    steps: [
      {
        id: "garment-colour",
        title: "Garment Colour",
        summary: "Bright White",
        confirmed: true,
      },
    ],
    quantity: 50,
  },
} as const;

describe("cloud design schema", () => {
  it("accepts the current configurator snapshot", () => {
    expect(cloudDesignSnapshotSchema.safeParse(validSnapshot).success).toBe(
      true,
    );
  });

  it("accepts a pending browser upload without persisting its IndexedDB key", () => {
    const pending = structuredClone(validSnapshot) as Record<string, unknown>;
    const configuration = pending.configuration as Record<string, unknown>;
    configuration.artwork = {
      front: {
        pendingUpload: true,
        fileName: "logo.svg",
        fileType: "svg",
        vectorized: true,
        width: 20,
        height: 5,
        fromNeck: 5,
        fromCenter: 0,
        printArea: "XS",
        guidelines: { maximumArea: true, leftChest: false },
        confirmed: false,
      },
    };

    expect(cloudDesignSnapshotSchema.safeParse(pending).success).toBe(true);
  });

  it("rejects browser-local object URLs and IndexedDB keys", () => {
    const unsafe = structuredClone(validSnapshot) as Record<string, unknown>;
    const configuration = unsafe.configuration as Record<string, unknown>;
    configuration.artwork = {
      front: {
        fileUrl: "blob:http://localhost/unsafe",
        fileKey: "browser-only-key",
        fileType: "svg",
        vectorized: true,
        width: 20,
        height: 5,
        fromNeck: 5,
        fromCenter: 0,
        printArea: "XS",
        guidelines: { maximumArea: true, leftChest: false },
        confirmed: false,
      },
    };

    expect(cloudDesignSnapshotSchema.safeParse(unsafe).success).toBe(false);
  });

  it("rejects unknown future schema versions", () => {
    expect(
      createDesignRequestSchema.safeParse({
        title: "Future draft",
        schemaVersion: 2,
        snapshot: { ...validSnapshot, schemaVersion: 2 },
        source: "configurator",
      }).success,
    ).toBe(false);
  });
});

describe("configurator draft migration boundary", () => {
  const localDraft = {
    version: 1,
    savedAt: "2026-07-29T12:00:00.000Z",
    colour: validSnapshot.configuration.colour,
    artwork: {},
    neckLabel: {},
    steps: validSnapshot.configuration.steps,
    quantity: 50,
  };

  it("normalizes the current local draft version", () => {
    expect(migrateConfiguratorDraft(localDraft, 1, 1)?.quantity).toBe(50);
  });

  it("preserves unknown future data by refusing to migrate it", () => {
    expect(migrateConfiguratorDraft({ ...localDraft, version: 2 }, 2, 1)).toBe(
      null,
    );
  });
});
