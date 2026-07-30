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

type RetainerEnvelope = ZohoApiEnvelope & {
  retainerinvoice?: Record<string, unknown>;
  retainerinvoices?: Record<string, unknown>[] | Record<string, unknown>;
};

function createdDocument(payload: RetainerEnvelope): Record<string, unknown> | null {
  if (payload.retainerinvoice && !Array.isArray(payload.retainerinvoice)) return payload.retainerinvoice;
  if (payload.retainerinvoices && !Array.isArray(payload.retainerinvoices)) return payload.retainerinvoices;
  return null;
}

export async function findRetainerByReference(
  client: ZohoClient,
  reference: string,
): Promise<AccountingDocumentRef | null> {
  const matches: Record<string, unknown>[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const query = new URLSearchParams({
      page: String(page),
      per_page: "200",
      sort_column: "created_time",
      sort_order: "D",
    });
    const response = await client.json<RetainerEnvelope>("retainerinvoices", { query });
    const rows = Array.isArray(response.retainerinvoices) ? response.retainerinvoices : [];
    matches.push(...rows.filter((row) => row.reference_number === reference));
    if (rows.length < 200) break;
  }
  if (matches.length > 1) {
    throw new ZohoProviderError({
      code: "ZOHO_AMBIGUOUS_DOCUMENT",
      message: `Multiple Zoho retainer invoices use reference ${reference}`,
      safeMessage: "Multiple accounting documents use the same Garmops reference. Finance review is required.",
      retryable: false,
    });
  }
  if (matches.length === 0) return null;
  const id = matches[0]?.retainerinvoice_id;
  if (typeof id !== "string" && typeof id !== "number") {
    throw new ZohoProviderError({
      code: "ZOHO_DOCUMENT_RESPONSE_INVALID",
      message: "Zoho document search returned no identifier",
      safeMessage: "Zoho returned an incomplete accounting document. Finance review is required.",
      retryable: true,
    });
  }
  const detail = await client.json<RetainerEnvelope>(`retainerinvoices/${encodeURIComponent(String(id))}`);
  if (!detail.retainerinvoice) {
    throw new ZohoProviderError({
      code: "ZOHO_DOCUMENT_RESPONSE_INVALID",
      message: "Zoho document detail is missing",
      safeMessage: "Zoho returned an incomplete accounting document. Finance review is required.",
      retryable: true,
    });
  }
  return parseZohoDocument("retainer_invoice", detail.retainerinvoice, true);
}

function lineRatePaise(input: ReservationDocumentInput): number {
  if (input.taxMode === "inclusive") return input.amountPaise;
  if (input.taxBasisPoints === null || input.taxBasisPoints === undefined) {
    throw new Error("Exclusive Zoho tax mode requires tax basis points");
  }
  return grossPaiseToExclusiveRatePaise(input.amountPaise, input.taxBasisPoints);
}

export async function createRetainer(
  client: ZohoClient,
  input: ReservationDocumentInput,
): Promise<AccountingDocumentRef> {
  const existing = await findRetainerByReference(client, input.externalReference);
  if (existing) return existing;

  const response = await client.json<RetainerEnvelope>("retainerinvoices", {
    method: "POST",
    body: {
      customer_id: input.customer.customerId,
      reference_number: input.externalReference,
      date: input.issueDate,
      contact_persons: input.customer.contactPersonIds,
      is_inclusive_tax: input.taxMode === "inclusive",
      place_of_supply: input.placeOfSupply || undefined,
      template_id: input.templateId || undefined,
      notes: `Advance received for ${input.orderNumber}. This reservation amount is adjustable against the final order subject to the accepted Garmops terms.`,
      terms: "This reservation payment is credited against the final order invoice subject to the accepted Garmops terms.",
      line_items: [
        {
          item_id: input.itemId,
          description: `Order reservation and production review advance\nReference: ${input.orderNumber}\nGross paid: INR ${(input.amountPaise / 100).toFixed(2)}`,
          item_order: 1,
          rate: paiseToZohoAmount(lineRatePaise(input)),
          tax_id: input.taxId,
        },
      ],
    },
  });
  const document = createdDocument(response);
  if (!document) throw new Error("Zoho retainer creation response is incomplete");
  return parseZohoDocument("retainer_invoice", document, false);
}

export async function markRetainerSent(client: ZohoClient, documentId: string): Promise<void> {
  await client.json<ZohoApiEnvelope>(`retainerinvoices/${encodeURIComponent(documentId)}/status/sent`, {
    method: "POST",
  });
}

export async function emailRetainer(
  client: ZohoClient,
  documentId: string,
  email: string,
  documentNumber: string,
): Promise<void> {
  await client.json<ZohoApiEnvelope>(`retainerinvoices/${encodeURIComponent(documentId)}/email`, {
    method: "POST",
    body: {
      to_mail_ids: [email],
      subject: `Garmops reservation payment document ${documentNumber}`,
      body: "Your Garmops reservation payment has been recorded. The official accounting PDF is also available in your Garmops account.",
      send_from_org_email_id: true,
    },
  });
}
