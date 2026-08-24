import { describe, expect, it } from "vitest";
import {
  createApprovalPdfBytes,
  type GenerateApprovalPdfOptions,
} from "./approvalPdf";

function pdfOptions(): GenerateApprovalPdfOptions {
  return {
    projectReference: "draft-design-spec",
    documentTitle: "Garmops Design Specification",
    items: [
      {
        id: "regular-tee",
        productName: "Classic T-Shirt",
        previewImage: "",
        colour: {
          type: "signature",
          name: "Classic White",
          hex: "#F5F5F2",
          confirmed: true,
        },
        artwork: {},
        neckLabel: {
          labelType: "standard-size",
          fileUrl: "",
          dimensions: "50x18",
          position: "below_neck_tape",
          stitch: "2_corner",
          confirmed: true,
        },
        sizeQuantities: { S: 10, M: 20, L: 20 },
        unitPrice: 535,
        gsm: 200,
        material: "100% cotton",
        fit: "Classic fit",
      },
    ],
    totals: {
      subtotal: 26_750,
      volumeDiscount: 0,
      gst: 1_337.5,
      total: 28_087.5,
    },
  };
}

describe("approval PDF", () => {
  it("creates a themed two-page design specification by default", async () => {
    const bytes = await createApprovalPdfBytes(
      pdfOptions(),
      new Date("2026-08-25T10:30:00+05:30"),
    );
    const document = new TextDecoder().decode(bytes);

    expect(document.startsWith("%PDF-1.4")).toBe(true);
    expect(document).toContain("/Count 2");
    expect(document).toContain("DESIGN SPECIFICATION / 01");
    expect(document).toContain("PRODUCTION DETAILS / 02");
    expect(document).toContain("0.98 0.973 0.961 rg 0 0 595 842 re f");
    expect(document).toContain("/BaseFont /Courier");
    expect(document).toContain("/Title (Garmops Design Specification)");
    expect(document).not.toContain("INTERNAL APPROVAL");
  });

  it("adds the approval page only when explicitly requested", async () => {
    const bytes = await createApprovalPdfBytes(
      { ...pdfOptions(), includeApprovalPage: true },
      new Date("2026-08-25T10:30:00+05:30"),
    );
    const document = new TextDecoder().decode(bytes);

    expect(document).toContain("/Count 3");
    expect(document).toContain("INTERNAL APPROVAL / 03");
  });
});
