import { describe, expect, it } from "vitest";
import { calculateTaxPaise, GST_RATE_BASIS_POINTS } from "@/lib/tax";

import { buildInvoicePdf } from "./pdf";

function input(lineCount: number) {
  return {
    number: "INV-2026-000001",
    issuedAt: "2026-08-05T12:00:00.000Z",
    seller: { legalName: "Moist Corp", address: "Greater Noida, Uttar Pradesh", gstin: "09ABCDE1234F1Z5", state: "Uttar Pradesh" },
    buyer: { name: "Customer", address: "Delhi", state: "Delhi" },
    lines: Array.from({ length: lineCount }, (_, index) => ({ description: `Configured product line ${index + 1}`, quantity: 50, totalPaise: 50_000, hsnCode: "610910" })),
    subtotalPaise: lineCount * 50_000,
    discountPaise: 0,
    taxableValuePaise: lineCount * 50_000,
    taxPaise: calculateTaxPaise(lineCount * 50_000),
    totalPaise: Math.round(lineCount * 50_000 * 1.05),
    gstRateBasisPoints: GST_RATE_BASIS_POINTS,
  };
}

describe("buildInvoicePdf", () => {
  it("keeps every multi-product line and creates additional pages", () => {
    const generated = buildInvoicePdf(input(20));
    const source = new TextDecoder().decode(generated.bytes);
    expect(source).toContain("Configured product line 1");
    expect(source).toContain("Configured product line 20");
    expect(source).toContain("/Count 2");
  });
});
