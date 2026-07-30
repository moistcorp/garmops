import "server-only";

import { parseZohoDocument } from "@/lib/providers/zoho/documentParsing";
import { ZohoProviderError } from "@/lib/providers/zoho/errors";
import { grossPaiseToExclusiveRatePaise, paiseToZohoAmount } from "@/lib/providers/zoho/money";
import type { ZohoClient } from "@/lib/providers/zoho/client";
import type {
  AccountingDocumentRef,
  ReservationDocumentInput,
  ZohoApiEnvelope,
} from "@/lib/providers/zoho/types";

type InvoiceEnvelope = ZohoApiEnvelope & {
  invoice?: Record<string, unknown>;
  invoices?: Record<string, unknown>[] | Record<string, unknown>;
};

export async function findInvoiceByReference(
  client: ZohoClient,
  reference: string,
): Promise<AccountingDocumentRef | null> {
  const matches: Record<string, unknown>[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const response = await client.json<InvoiceEnvelope>("invoices", {
      query: new URLSearchParams({
        page: String(page),
        per_page: "200",
        sort_column: "created_time",
        sort_order: "D",
      }),
    });
    const rows = Array.isArray(response.invoices) ? response.invoices : [];
    matches.push(...rows.filter((row) => row.reference_number === reference));
    if (rows.length < 200) break;
  }
  if (matches.length > 1) {
    throw new ZohoProviderError({
      code: "ZOHO_AMBIGUOUS_DOCUMENT",
      message: `Multiple Zoho invoices use reference ${reference}`,
      safeMessage: "Multiple accounting documents use the same Garmops reference. Finance review is required.",
      retryable: false,
    });
  }
  if (matches.length === 0) return null;
  const id = matches[0]?.invoice_id;
  if (typeof id !== "string" && typeof id !== "number") {
    throw new ZohoProviderError({
      code: "ZOHO_DOCUMENT_RESPONSE_INVALID",
      message: "Zoho document search returned no identifier",
      safeMessage: "Zoho returned an incomplete accounting document. Finance review is required.",
      retryable: true,
    });
  }
  const detail = await client.json<InvoiceEnvelope>(`invoices/${encodeURIComponent(String(id))}`);
  if (!detail.invoice) {
    throw new ZohoProviderError({
      code: "ZOHO_DOCUMENT_RESPONSE_INVALID",
      message: "Zoho document detail is missing",
      safeMessage: "Zoho returned an incomplete accounting document. Finance review is required.",
      retryable: true,
    });
  }
  return parseZohoDocument("standard_invoice", detail.invoice, true);
}

function lineRatePaise(input: ReservationDocumentInput): number {
  if (input.taxMode === "inclusive") return input.amountPaise;
  if (input.taxBasisPoints === null || input.taxBasisPoints === undefined) {
    throw new Error("Exclusive Zoho tax mode requires tax basis points");
  }
  return grossPaiseToExclusiveRatePaise(input.amountPaise, input.taxBasisPoints);
}

export async function createInvoice(
  client: ZohoClient,
  input: ReservationDocumentInput,
): Promise<AccountingDocumentRef> {
  const existing = await findInvoiceByReference(client, input.externalReference);
  if (existing) return existing;
  const response = await client.json<InvoiceEnvelope>("invoices", {
    method: "POST",
    body: {
      customer_id: input.customer.customerId,
      reference_number: input.externalReference,
      date: input.issueDate,
      payment_terms: 0,
      contact_persons: input.customer.contactPersonIds,
      is_inclusive_tax: input.taxMode === "inclusive",
      place_of_supply: input.placeOfSupply || undefined,
      template_id: input.templateId || undefined,
      notes: `Reservation and production review payment for ${input.orderNumber}.`,
      terms: "This document records the paid reservation amount under the accepted Garmops terms.",
      line_items: [
        {
          item_id: input.itemId,
          quantity: 1,
          description: `Order reservation and production review fee\nReference: ${input.orderNumber}`,
          rate: paiseToZohoAmount(lineRatePaise(input)),
          tax_id: input.taxId,
        },
      ],
    },
  });
  const raw = response.invoice ?? (!Array.isArray(response.invoices) ? response.invoices : null);
  if (!raw) throw new Error("Zoho invoice creation response is incomplete");
  return parseZohoDocument("standard_invoice", raw, false);
}

export async function markInvoiceSent(client: ZohoClient, documentId: string): Promise<void> {
  await client.json<ZohoApiEnvelope>(`invoices/${encodeURIComponent(documentId)}/status/sent`, { method: "POST" });
}

export async function emailInvoice(
  client: ZohoClient,
  documentId: string,
  email: string,
  documentNumber: string,
): Promise<void> {
  await client.json<ZohoApiEnvelope>(`invoices/${encodeURIComponent(documentId)}/email`, {
    method: "POST",
    body: {
      to_mail_ids: [email],
      subject: `Garmops reservation invoice ${documentNumber}`,
      body: "Your Garmops reservation payment has been recorded. The official accounting PDF is also available in your Garmops account.",
      send_from_org_email_id: true,
    },
  });
}
