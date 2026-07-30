import { describe, expect, it, vi } from "vitest";

import type { ZohoClient } from "./client";
import {
  createCustomerPayment,
  findCustomerPaymentByReference,
} from "./payments";
import type { AccountingDocumentRef } from "./types";

const document: AccountingDocumentRef = Object.freeze({
  provider: "zoho_invoice",
  mode: "retainer_invoice",
  documentId: "RET-1",
  documentNumber: "RET-0001",
  customerId: "CONTACT-1",
  issueDate: "2026-07-30",
  status: "sent",
  subtotalPaise: 49_900,
  taxPaise: 0,
  totalPaise: 49_900,
  paidPaise: 0,
  balancePaise: 49_900,
  adoptedExisting: false,
  snapshot: Object.freeze({}),
});

function clientWithJson(json: ReturnType<typeof vi.fn>): ZohoClient {
  return { json } as unknown as ZohoClient;
}

describe("Zoho customer payment idempotency", () => {
  it("searches by the deterministic PayU reference", async () => {
    const json = vi
      .fn()
      .mockResolvedValueOnce({ code: 0, customerpayments: [] });

    const result = await findCustomerPaymentByReference(
      clientWithJson(json),
      "PAYU-403993715530000001",
    );

    expect(result).toBeNull();
    const options = json.mock.calls[0]?.[1] as { query: URLSearchParams };
    expect(options.query.get("reference_number")).toBe(
      "PAYU-403993715530000001",
    );
  });

  it("adopts a previously created payment after an ambiguous timeout", async () => {
    const json = vi
      .fn()
      .mockResolvedValueOnce({
        code: 0,
        customerpayments: [
          {
            payment_id: "PAYMENT-1",
            reference_number: "PAYU-1",
            amount: 499,
          },
        ],
      })
      .mockResolvedValueOnce({
        code: 0,
        payment: {
          payment_id: "PAYMENT-1",
          reference_number: "PAYU-1",
          amount: 499,
          status: "success",
        },
      });

    const result = await createCustomerPayment(clientWithJson(json), {
      customerId: "CONTACT-1",
      document,
      amountPaise: 49_900,
      paymentDate: "2026-07-30",
      referenceNumber: "PAYU-1",
      orderNumber: "GAR-2026-000001",
    });

    expect(result.paymentId).toBe("PAYMENT-1");
    expect(result.adoptedExisting).toBe(true);
    expect(json).toHaveBeenCalledTimes(2);
  });

  it("creates one full payment when no matching reference exists", async () => {
    const json = vi
      .fn()
      .mockResolvedValueOnce({ code: 0, customerpayments: [] })
      .mockResolvedValueOnce({
        code: 0,
        payment: {
          payment_id: "PAYMENT-2",
          reference_number: "PAYU-2",
          amount: 499,
          status: "success",
        },
      });

    const result = await createCustomerPayment(clientWithJson(json), {
      customerId: "CONTACT-1",
      document,
      amountPaise: 49_900,
      paymentDate: "2026-07-30",
      referenceNumber: "PAYU-2",
      orderNumber: "GAR-2026-000002",
    });

    expect(result.adoptedExisting).toBe(false);
    const createCall = json.mock.calls[1];
    expect(createCall?.[0]).toBe("customerpayments");
    expect(createCall?.[1]).toMatchObject({
      method: "POST",
      body: {
        customer_id: "CONTACT-1",
        amount: 499,
        invoices: [{ invoice_id: "RET-1", amount_applied: 499 }],
      },
    });
  });

  it("fails closed when an adopted payment amount differs from PayU", async () => {
    const json = vi
      .fn()
      .mockResolvedValueOnce({
        code: 0,
        customerpayments: [
          {
            payment_id: "PAYMENT-3",
            reference_number: "PAYU-3",
            amount: 498,
          },
        ],
      })
      .mockResolvedValueOnce({
        code: 0,
        payment: {
          payment_id: "PAYMENT-3",
          reference_number: "PAYU-3",
          amount: 498,
        },
      });

    await expect(
      createCustomerPayment(clientWithJson(json), {
        customerId: "CONTACT-1",
        document,
        amountPaise: 49_900,
        paymentDate: "2026-07-30",
        referenceNumber: "PAYU-3",
        orderNumber: "GAR-2026-000003",
      }),
    ).rejects.toMatchObject({ code: "ZOHO_PAYMENT_AMOUNT_MISMATCH" });
  });
});
