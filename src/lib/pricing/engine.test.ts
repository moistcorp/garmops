import { describe, expect, it } from "vitest";
import { buildEstimateSnapshot, calculateEstimatePricing } from "./engine";
import { estimateFilename, deriveEstimateStatus, isEstimateCurrent } from "@/lib/estimates/presentation";
import type { CloudDesignSnapshot } from "@/lib/designs/schema";
import type { ArtworkSide, NeckLabel } from "@/lib/configurator/types/configurator";

const artwork = (extra: Partial<ArtworkSide> = {}): ArtworkSide => ({
  fileUrl: "",
  fileType: "png",
  vectorized: true,
  width: 20,
  height: 20,
  fromNeck: 5,
  fromCenter: 0,
  printArea: "M",
  guidelines: { maximumArea: false, leftChest: false },
  confirmed: true,
  ...extra,
});

const label = (extra: Partial<NeckLabel> = {}): NeckLabel => ({
  fileUrl: "",
  dimensions: "50x18",
  position: "below_neck_tape",
  stitch: "2_corner",
  confirmed: true,
  ...extra,
});

const design = (configuration: Partial<CloudDesignSnapshot["configuration"]> = {}): CloudDesignSnapshot => ({
  schemaVersion: 1,
  kind: "configurator_build",
  configId: "regular-fit-tee-200gsm",
  savedAt: "2026-08-02T10:00:00+05:30",
  configuration: {
    colour: { type: "signature", name: "Navy", hex: "#16212B", confirmed: true },
    artwork: {},
    steps: [
      { id: "garment-colour", title: "Garment Colour", summary: "Navy", confirmed: true },
      { id: "artwork", title: "Artwork", summary: null, confirmed: true, skipped: true },
      { id: "neck-label", title: "Neck Label", summary: null, confirmed: true, skipped: true },
    ],
    quantity: 250,
    ...configuration,
  },
});

describe("authoritative estimate pricing", () => {
  it("charges artwork when represented by a public URL or only a private file id", () => {
    const withUrl = calculateEstimatePricing(design({ artwork: { front: artwork({ fileUrl: "/artwork.png", technique: "screen_print" }) } }));
    const withFileId = calculateEstimatePricing(design({ artwork: { front: artwork({ fileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", technique: "screen_print" }) } }));
    expect(withFileId.configuredUnitPricePaise).toBe(withUrl.configuredUnitPricePaise);
    expect(withFileId.discountPaise).toBeGreaterThan(0);
  });

  it("charges a neck label when represented by a private file id", () => {
    const without = calculateEstimatePricing(design());
    const withLabel = calculateEstimatePricing(design({ neckLabel: label({ fileId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }) }));
    expect(withLabel.configuredUnitPricePaise - without.configuredUnitPricePaise).toBe(2500);
  });

  it("uses the expected volume discount boundaries and integer paise rounding", () => {
    const at249 = calculateEstimatePricing(design({ quantity: 249 }));
    const at250 = calculateEstimatePricing(design({ quantity: 250 }));
    expect(at250.discountedUnitPricePaise).toBeLessThan(at249.discountedUnitPricePaise);
    expect(at250.totalPaise).toBe(at250.taxableSubtotalPaise + at250.gstPaise);
    expect(Number.isInteger(at250.gstPaise)).toBe(true);
  });

  it("keeps the snapshot sufficient to explain the estimate", () => {
    const current = design({ artwork: { back: artwork({ fileId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", technique: "embroidery" }) } });
    const pricing = calculateEstimatePricing(current);
    const snapshot = buildEstimateSnapshot(current, { companyName: "Acme", contactName: "Riya Rao", contactEmail: "riya@example.com", gstin: null, billingCity: "Mumbai", billingState: "Maharashtra" }, pricing);
    expect(snapshot.customisation.back.present).toBe(true);
    expect(snapshot.customisation.back.technique).toBe("embroidery");
    expect(snapshot.shipping.included).toBe(false);
  });
});

describe("estimate lifecycle presentation", () => {
  it("detects stale and expired estimates without rewriting them", () => {
    const estimate = { status: "active" as const, valid_until: "2026-08-10T00:00:00Z", design_revision: 4 };
    expect(isEstimateCurrent(estimate, 4)).toBe(true);
    expect(isEstimateCurrent(estimate, 5)).toBe(false);
    expect(deriveEstimateStatus({ ...estimate, valid_until: "2026-07-01T00:00:00Z" }, new Date("2026-08-02T00:00:00Z"))).toBe("expired");
  });

  it("uses the customer-facing estimate filename", () => {
    expect(estimateFilename("EST-2026-000123")).toBe("Garmops-Estimate-EST-2026-000123.pdf");
  });
});
