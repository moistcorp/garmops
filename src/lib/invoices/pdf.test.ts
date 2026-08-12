import { describe, expect, it } from "vitest";

import { calculateTaxPaise, GST_RATE_BASIS_POINTS } from "@/lib/tax";

import { amountInWords } from "./amountInWords";
import { buildInvoicePdf, type InvoicePdfInput } from "./pdf";

function input(lineCount = 1, overrides: Partial<InvoicePdfInput> = {}): InvoicePdfInput {
  return {
    number: "INV-2026-000001",
    issuedAt: "2026-08-05T12:00:00.000Z",
    orderNumber: "GAR-2026-000042",
    orderDate: "2026-08-04T10:00:00.000Z",
    placeOfSupply: "Delhi",
    seller: {
      legalName: "M/s Moist Corp",
      address: "Greater Noida, Uttar Pradesh",
      gstin: "09ABCDE1234F1Z5",
      state: "Uttar Pradesh",
      bank: { name: "HDFC Bank", accountNumber: "50200110390895", ifsc: "HDFC0005731" },
      msme: "UDYAM-UP-28-0157794",
    },
    buyer: { name: "Customer", address: "Delhi", state: "Delhi" },
    lines: Array.from({ length: lineCount }, (_, index) => ({
      description: `Configured product line ${index + 1}`,
      quantity: 50,
      totalPaise: 50_000,
      hsnCode: "610910",
    })),
    subtotalPaise: lineCount * 50_000,
    discountPaise: 0,
    taxableValuePaise: lineCount * 50_000,
    taxPaise: calculateTaxPaise(lineCount * 50_000),
    totalPaise: Math.round(lineCount * 50_000 * 1.05),
    gstRateBasisPoints: GST_RATE_BASIS_POINTS,
    ...overrides,
  };
}

function sourceOf(invoice: InvoicePdfInput): string {
  return new TextDecoder().decode(buildInvoicePdf(invoice).bytes);
}

describe("buildInvoicePdf", () => {
  it("renders the formal single-page invoice structure and trusted logo resource", () => {
    const source = sourceOf(input());
    expect(source).toContain("INV-2026-000001");
    expect(source).toContain("GAR-2026-000042");
    expect(source).toContain("HDFC Bank");
    expect(source).toContain("50200110390895");
    expect(source).toContain("HDFC0005731");
    expect(source).toContain("UDYAM-UP-28-0157794");
    expect(source).toContain("Shipping");
    expect(source).toContain("Free");
    expect(source).toContain("Authorised Signatory");
    expect(source).toContain("This is a system-generated tax invoice.");
    expect(source).toContain("/Subtype /Image");
    expect(source).toContain("/Im1 Do");
  });

  it("removes stale shipping, delivery, and refund-policy language", () => {
    const source = sourceOf(input());
    expect(source).not.toContain("For refunds and re-prints");
    expect(source).not.toContain("return rejected prints");
    expect(source).not.toContain("Shipping is excluded");
    expect(source).not.toContain("staff-issued payment link");
    expect(source).not.toContain("GOODS DELIVERED");
  });

  it("shows same-state CGST and SGST with the exact persisted tax split", () => {
    const source = sourceOf(input(1, {
      buyer: { name: "UP Customer", address: "Noida, Uttar Pradesh", state: "Uttar Pradesh" },
      placeOfSupply: "Uttar Pradesh",
      taxPaise: 1_433,
    }));
    expect(source).toContain("CGST \\(2.50%\\)");
    expect(source).toContain("SGST \\(2.50%\\)");
    expect(source).toContain("Rs. 7.16");
    expect(source).toContain("Rs. 7.17");
  });

  it("shows interstate IGST and omits a missing customer GSTIN", () => {
    const source = sourceOf(input());
    expect(source).toContain("IGST \\(5.00%\\)");
    expect(source).not.toContain("Customer GSTIN/UIN:");
  });

  it("preserves customer Unicode text while using safe Rs. currency rendering", () => {
    const source = sourceOf(input(1, {
      buyer: { name: "ग्राहक ₹", address: "गौतम बुद्ध नगर, उत्तर प्रदेश", state: "Uttar Pradesh" },
    }));
    expect(source).toContain("ग्राहक ₹");
    expect(source).toContain("गौतम बुद्ध नगर");
    expect(source).toContain("Shipping: Free");
    expect(source).toContain("Rs. 525.00");
  });

  it("shows Discount only when the persisted discount is positive", () => {
    expect(sourceOf(input())).not.toContain("Discount");
    expect(sourceOf(input(1, { discountPaise: 1250, taxableValuePaise: 48_750 })).toString()).toContain("Discount");
  });

  it("renders exact Indian amount-in-words grouping for rupees and paise", () => {
    expect(amountInWords(30_082_50)).toBe("INR Thirty Thousand Eighty Two and Fifty Paise Only");
    expect(amountInWords(12_34_567_89)).toBe("INR Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven and Eighty Nine Paise Only");
    expect(amountInWords(12_34_56_789_00)).toBe("INR Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine Only");
    expect(sourceOf(input(1, { totalPaise: 30_082_50 }))).toContain("Amount chargeable \\(in words\\):");
  });

  it("keeps multi-page lines and repeats a continuation header while finalising once", () => {
    const source = sourceOf(input(20));
    expect(source).toContain("Configured product line 1");
    expect(source).toContain("Configured product line 20");
    expect(source).toContain("Tax Invoice - Continued");
    expect(source).toContain("Continued on next page");
    expect(source).toContain("/Count 2");
    expect(source.match(/Balance Due/g)?.length).toBe(1);
  });

  it("wraps long descriptions and addresses without dropping content", () => {
    const source = sourceOf(input(1, {
      seller: {
        legalName: "M/s Moist Corp",
        address: "2nd Floor, Q-5 Site-5, Road Number 4, Prime Infra Engineers, UPSIDC Site 5, Greater Noida, Gautambuddha Nagar, Uttar Pradesh 201312",
        gstin: "09ABCDE1234F1Z5",
        state: "Uttar Pradesh",
        bank: { name: "HDFC Bank", accountNumber: "50200110390895", ifsc: "HDFC0005731" },
        msme: "UDYAM-UP-28-0157794",
      },
      buyer: { name: "A very long customer name with parentheses (and a slash)", address: "A detailed billing address with multiple locality names, Greater Noida, Gautambuddha Nagar, Uttar Pradesh 201312", state: "Uttar Pradesh" },
      placeOfSupply: "Uttar Pradesh",
      lines: [{ description: "A deliberately long configured product description that must wrap across several lines without colliding with the HSN, quantity, rate, GST, or amount columns", quantity: 3, totalPaise: 12_345, hsnCode: "610910" }],
      subtotalPaise: 12_345,
      taxableValuePaise: 12_345,
      taxPaise: 617,
      totalPaise: 12_962,
    }));
    expect(source).toContain("deliberately long configured product");
    expect(source).toContain("A detailed billing address");
    expect(source).toContain("\\(");
  });
});
