import "server-only";

import type { ZohoClient } from "@/lib/providers/zoho/client";
import { ZohoProviderError } from "@/lib/providers/zoho/errors";
import { paiseToZohoAmount, zohoAmountToPaise } from "@/lib/providers/zoho/money";
import type {
  AccountingPaymentInput,
  AccountingPaymentRef,
  ZohoApiEnvelope,
} from "@/lib/providers/zoho/types";

type PaymentRow = Record<string, unknown>;
type PaymentEnvelope = ZohoApiEnvelope & {
  payment?: PaymentRow;
  customerpayment?: PaymentRow;
  payments?: PaymentRow[];
  customerpayments?: PaymentRow[];
};

function paymentId(row: PaymentRow): string | null {
  const value = row.payment_id ?? row.customer_payment_id;
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function parsePayment(row: PaymentRow, adoptedExisting: boolean): AccountingPaymentRef {
  const id = paymentId(row);
  const reference = row.reference_number;
  if (!id || typeof reference !== "string") {
    throw new ZohoProviderError({
      code: "ZOHO_PAYMENT_RESPONSE_INVALID",
      message: "Zoho customer payment response is incomplete",
      safeMessage: "Zoho returned an incomplete payment record. Finance review is required.",
      retryable: true,
    });
  }
  return Object.freeze({
    provider: "zoho_invoice" as const,
    paymentId: id,
    amountPaise: zohoAmountToPaise(row.amount ?? 0),
    referenceNumber: reference,
    adoptedExisting,
    snapshot: Object.freeze({
      payment_id: id,
      status: row.status ?? null,
      amount: row.amount ?? null,
      date: row.date ?? null,
      reference_number: reference,
    }),
  });
}

export async function findCustomerPaymentByReference(
  client: ZohoClient,
  reference: string,
): Promise<AccountingPaymentRef | null> {
  const response = await client.json<PaymentEnvelope>("customerpayments", {
    query: new URLSearchParams({
      reference_number: reference,
      page: "1",
      per_page: "200",
    }),
  });
  const rows = response.customerpayments ?? response.payments ?? [];
  const exact: PaymentRow[] = [];
  for (const row of rows) {
    const id = paymentId(row);
    if (!id) continue;
    const detail = await client.json<PaymentEnvelope>(
      `customerpayments/${encodeURIComponent(id)}`,
    );
    const candidate = detail.payment ?? detail.customerpayment ?? row;
    if (candidate.reference_number === reference) exact.push(candidate);
  }
  if (exact.length > 1) {
    throw new ZohoProviderError({
      code: "ZOHO_AMBIGUOUS_PAYMENT",
      message: `Multiple Zoho customer payments use reference ${reference}`,
      safeMessage: "Multiple accounting payments use the same Garmops reference. Finance review is required.",
      retryable: false,
    });
  }
  if (exact.length === 0) return null;
  return parsePayment(exact[0], true);
}

export async function createCustomerPayment(
  client: ZohoClient,
  input: AccountingPaymentInput,
): Promise<AccountingPaymentRef> {
  const existing = await findCustomerPaymentByReference(
    client,
    input.referenceNumber,
  );
  if (existing) {
    if (existing.amountPaise !== input.amountPaise) {
      throw new ZohoProviderError({
        code: "ZOHO_PAYMENT_AMOUNT_MISMATCH",
        message: "Existing Zoho payment amount differs from verified PayU payment",
        safeMessage: "The accounting payment amount does not match PayU. Finance review is required.",
        retryable: false,
      });
    }
    return existing;
  }

  const response = await client.json<PaymentEnvelope>("customerpayments", {
    method: "POST",
    body: {
      customer_id: input.customerId,
      payment_mode: "others",
      amount: paiseToZohoAmount(input.amountPaise),
      date: input.paymentDate,
      reference_number: input.referenceNumber,
      description: `PayU reservation payment recorded by Garmops for ${input.orderNumber}.`,
      invoices: [
        {
          invoice_id: input.document.documentId,
          amount_applied: paiseToZohoAmount(input.amountPaise),
        },
      ],
    },
  });

  const row = response.payment ?? response.customerpayment;
  if (!row) {
    throw new ZohoProviderError({
      code: "ZOHO_PAYMENT_RESPONSE_INVALID",
      message: "Zoho payment creation response is incomplete",
      safeMessage: "Zoho returned an incomplete payment record. Finance review is required.",
      retryable: true,
    });
  }
  return parsePayment(row, false);
}
