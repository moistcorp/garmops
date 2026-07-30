import { describe, expect, it } from "vitest";

import { parseZohoDocument } from "./documentParsing";

describe("Zoho accounting document parsing", () => {
  it("normalises a retainer response to integer paise", () => {
    const document = parseZohoDocument(
      "retainer_invoice",
      {
        retainerinvoice_id: "RET-ID-1",
        retainerinvoice_number: "RET-0001",
        customer_id: "CONTACT-1",
        date: "2026-07-30",
        status: "paid",
        sub_total: "422.88",
        total: "499.00",
        payment_made: "499.00",
        balance: "0.00",
        reference_number: "GARMOPS-RESERVATION-1",
        is_emailed: true,
      },
      true,
    );

    expect(document.documentId).toBe("RET-ID-1");
    expect(document.totalPaise).toBe(49_900);
    expect(document.paidPaise).toBe(49_900);
    expect(document.balancePaise).toBe(0);
    expect(document.taxPaise).toBe(7_612);
    expect(document.adoptedExisting).toBe(true);
    expect(document.snapshot.is_emailed).toBe(true);
  });

  it("normalises a standard invoice response", () => {
    const document = parseZohoDocument(
      "standard_invoice",
      {
        invoice_id: 123,
        invoice_number: "INV-001",
        customer_id: 456,
        date: "2026-07-30",
        status: "draft",
        sub_total: 499,
        total: 499,
        payment_made: 0,
        balance: 499,
      },
      false,
    );

    expect(document.documentId).toBe("123");
    expect(document.customerId).toBe("456");
    expect(document.totalPaise).toBe(49_900);
  });

  it("rejects an incomplete provider document", () => {
    expect(() =>
      parseZohoDocument("retainer_invoice", { total: 499 }, false),
    ).toThrow(/incomplete/i);
  });
});
