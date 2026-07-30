import "server-only";

import { getServerEnvironment } from "@/lib/config/env";
import { createZohoClient, type ZohoClient } from "@/lib/providers/zoho/client";
import { ensureZohoCustomer } from "@/lib/providers/zoho/contacts";
import {
  createInvoice,
  emailInvoice,
  findInvoiceByReference,
  markInvoiceSent,
} from "@/lib/providers/zoho/invoices";
import { createCustomerPayment } from "@/lib/providers/zoho/payments";
import { downloadZohoDocumentPdf } from "@/lib/providers/zoho/pdf";
import {
  createRetainer,
  emailRetainer,
  findRetainerByReference,
  markRetainerSent,
} from "@/lib/providers/zoho/retainers";
import type {
  AccountingCustomerInput,
  AccountingDocumentActionInput,
  AccountingDocumentRef,
  AccountingPaymentInput,
  AccountingProvider,
  ExternalReferenceInput,
  ReservationDocumentInput,
} from "@/lib/providers/zoho/types";

export class ZohoInvoiceProvider implements AccountingProvider {
  constructor(private readonly client: ZohoClient) {}

  ensureCustomer(input: AccountingCustomerInput) {
    return ensureZohoCustomer(this.client, input);
  }

  createReservationDocument(input: ReservationDocumentInput) {
    return input.mode === "retainer_invoice"
      ? createRetainer(this.client, input)
      : createInvoice(this.client, input);
  }

  recordPayment(input: AccountingPaymentInput) {
    return createCustomerPayment(this.client, input);
  }

  async markOrSendDocument(input: AccountingDocumentActionInput): Promise<void> {
    const sendEmail = getServerEnvironment().ZOHO_SEND_DOCUMENT_EMAIL;
    const alreadySent = ["sent", "paid"].includes(input.document.status.toLowerCase());
    const alreadyEmailed = input.document.snapshot.is_emailed === true;
    if (input.document.mode === "retainer_invoice") {
      if (!alreadySent) await markRetainerSent(this.client, input.document.documentId);
      if (!sendEmail || alreadyEmailed) return;
      await emailRetainer(
        this.client,
        input.document.documentId,
        input.customerEmail,
        input.document.documentNumber,
      );
      return;
    }
    if (!alreadySent) await markInvoiceSent(this.client, input.document.documentId);
    if (!sendEmail || alreadyEmailed) return;
    await emailInvoice(
      this.client,
      input.document.documentId,
      input.customerEmail,
      input.document.documentNumber,
    );
  }

  downloadDocumentPdf(input: AccountingDocumentRef) {
    return downloadZohoDocumentPdf(this.client, input);
  }

  findReservationDocumentByExternalReference(input: ExternalReferenceInput) {
    return input.mode === "retainer_invoice"
      ? findRetainerByReference(this.client, input.externalReference)
      : findInvoiceByReference(this.client, input.externalReference);
  }
}

export async function createZohoInvoiceProvider(): Promise<ZohoInvoiceProvider> {
  return new ZohoInvoiceProvider(await createZohoClient());
}
