import "server-only";

import { getServerEnvironment } from "@/lib/config/env";
import { asZohoProviderError, ZohoProviderError } from "@/lib/providers/zoho/errors";
import { utcTimestampToIndiaDate } from "@/lib/providers/zoho/money";
import { createZohoInvoiceProvider } from "@/lib/providers/zoho/provider";
import type {
  AccountingAddressInput,
  AccountingDocumentMode,
} from "@/lib/providers/zoho/types";
import { putPrivatePdf } from "@/lib/r2/put";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.generated";

type ObjectRecord = Record<string, unknown>;

function record(value: unknown): ObjectRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ObjectRecord)
    : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function optionalText(value: unknown): string | null {
  const normalized = text(value);
  return normalized || null;
}

function safeFilePart(value: string): string {
  return value.normalize("NFKC").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "document";
}

function accountingAddress(snapshot: ObjectRecord, fallbackName: string): AccountingAddressInput {
  const address = record(snapshot.address);
  const line1 = text(address.line1);
  const city = text(address.city);
  const state = text(address.state);
  const zip = text(address.postalCode);
  if (!line1 || !city || !state || !zip) {
    throw new ZohoProviderError({
      code: "INVOICE_BILLING_ADDRESS_INCOMPLETE",
      message: "The immutable billing address snapshot is incomplete",
      safeMessage: "The billing address is incomplete. Finance or the customer must correct it.",
      retryable: false,
    });
  }
  return Object.freeze({
    attention: text(address.contactName, fallbackName),
    address: line1,
    street2: optionalText(address.line2),
    city,
    state,
    zip,
    country: text(address.countryCode) === "IN" ? "India" : text(address.countryCode, "India"),
    phone: optionalText(address.phone),
  });
}

export type ReservationInvoiceJobResult = Readonly<{
  invoiceId: string;
  documentNumber: string;
  paymentId: string;
  pdfFileId: string;
  adoptedDocument: boolean;
  adoptedPayment: boolean;
}>;

export async function createReservationInvoice(
  invoiceId: string,
): Promise<ReservationInvoiceJobResult> {
  const environment = getServerEnvironment();
  if (!environment.ZOHO_INVOICE_AUTOMATION_ENABLED) {
    throw new ZohoProviderError({
      code: "ZOHO_AUTOMATION_DISABLED",
      message: "Zoho invoice automation feature flag is disabled",
      safeMessage: "Zoho invoice automation is disabled by an administrator.",
      retryable: false,
    });
  }

  const admin = createAdminClient();
  const invoiceTable = admin.from("invoices");
  const { data: invoice, error: invoiceError } = await invoiceTable
    .select("id, order_id, payment_attempt_id, kind, sync_status, reference_number, currency, total_paise, pdf_file_id, completed_at, attempt_count")
    .eq("id", invoiceId)
    .maybeSingle();
  if (invoiceError || !invoice) {
    throw new ZohoProviderError({
      code: "INVOICE_NOT_FOUND",
      message: invoiceError?.message ?? `Invoice ${invoiceId} not found`,
      safeMessage: "The reservation invoice record is unavailable.",
      retryable: false,
    });
  }
  if (invoice.sync_status === "completed" && invoice.pdf_file_id && invoice.completed_at) {
    const { data: completed } = await invoiceTable
      .select("document_number, zoho_payment_id")
      .eq("id", invoice.id)
      .single();
    if (completed?.document_number && completed.zoho_payment_id) {
      return Object.freeze({
        invoiceId: invoice.id,
        documentNumber: completed.document_number,
        paymentId: completed.zoho_payment_id,
        pdfFileId: invoice.pdf_file_id,
        adoptedDocument: true,
        adoptedPayment: true,
      });
    }
  }

  const [{ data: order, error: orderError }, { data: attempt, error: attemptError }] = await Promise.all([
    admin
      .from("orders")
      .select("id, order_number, order_type, organization_id, customer_user_id, currency, billing_snapshot, customer_snapshot, company_snapshot, reservation_paid_at")
      .eq("id", invoice.order_id)
      .single(),
    admin
      .from("payment_attempts")
      .select("id, order_id, provider_payment_id, purpose, amount_paise, currency, status, paid_at")
      .eq("id", invoice.payment_attempt_id ?? "00000000-0000-0000-0000-000000000000")
      .single(),
  ]);
  if (orderError || !order || attemptError || !attempt) {
    throw new ZohoProviderError({
      code: "INVOICE_AGGREGATE_INCOMPLETE",
      message: orderError?.message ?? attemptError?.message ?? "Invoice aggregate is incomplete",
      safeMessage: "The paid order could not be loaded for accounting.",
      retryable: true,
    });
  }
  if (
    attempt.status !== "paid" ||
    attempt.purpose !== "reservation" ||
    !attempt.provider_payment_id ||
    !attempt.paid_at ||
    attempt.order_id !== order.id ||
    !["custom_bulk", "reorder"].includes(order.order_type)
  ) {
    throw new ZohoProviderError({
      code: "INVOICE_PAYMENT_NOT_VERIFIED",
      message: "Reservation invoice requires one verified paid PayU reservation",
      safeMessage: "The payment is not eligible for automatic invoicing.",
      retryable: false,
    });
  }
  if (
    attempt.currency !== "INR" ||
    order.currency !== "INR" ||
    invoice.currency !== "INR" ||
    attempt.amount_paise !== environment.RESERVATION_AMOUNT_PAISE ||
    invoice.total_paise !== attempt.amount_paise
  ) {
    throw new ZohoProviderError({
      code: "INVOICE_AMOUNT_MISMATCH",
      message: "The PayU payment and invoice amount do not reconcile",
      safeMessage: "The accounting amount does not match the verified payment. Finance review is required.",
      retryable: false,
    });
  }

  const { error: processingError } = await (invoiceTable as any)
    .update({
      sync_status: "processing",
      attempt_count: invoice.attempt_count,
      next_attempt_at: null,
      last_error_code: null,
      last_error_message: null,
    })
    .eq("id", invoice.id);
  if (processingError) throw new Error(processingError.message);

  const [{ data: organization, error: organizationError }, { data: profile }] = await Promise.all([
    admin
      .from("organizations")
      .select("id, legal_name, display_name, website, gstin, billing_email, phone, zoho_contact_id")
      .eq("id", order.organization_id)
      .single(),
    admin
      .from("profiles")
      .select("first_name, last_name, phone")
      .eq("id", order.customer_user_id)
      .maybeSingle(),
  ]);
  if (organizationError || !organization) {
    throw new ZohoProviderError({
      code: "INVOICE_ORGANIZATION_MISSING",
      message: organizationError?.message ?? "Organization is missing",
      safeMessage: "The customer company record is incomplete.",
      retryable: false,
    });
  }

  const customerSnapshot = record(order.customer_snapshot);
  const companySnapshot = record(order.company_snapshot);
  const billingSnapshot = record(order.billing_snapshot);
  const customerEmail = text(
    customerSnapshot.email,
    text(customerSnapshot.accountEmail, text(organization.billing_email)),
  ).toLowerCase();
  if (!customerEmail || !customerEmail.includes("@")) {
    throw new ZohoProviderError({
      code: "INVOICE_CUSTOMER_EMAIL_MISSING",
      message: "Customer email is required for the accounting contact",
      safeMessage: "The customer billing email is missing.",
      retryable: false,
    });
  }

  const provider = await createZohoInvoiceProvider();
  const customer = await provider.ensureCustomer({
    organizationId: organization.id,
    existingProviderId: organization.zoho_contact_id,
    legalName: text(companySnapshot.legalName, organization.legal_name),
    displayName: text(companySnapshot.displayName, organization.display_name),
    email: customerEmail,
    phone: optionalText(customerSnapshot.phone) ?? organization.phone ?? profile?.phone ?? null,
    firstName: optionalText(customerSnapshot.firstName) ?? profile?.first_name ?? null,
    lastName: optionalText(customerSnapshot.lastName) ?? profile?.last_name ?? null,
    gstin: optionalText(companySnapshot.gstin) ?? organization.gstin ?? null,
    website: optionalText(companySnapshot.website) ?? organization.website ?? null,
    billingAddress: accountingAddress(billingSnapshot, organization.display_name),
  });

  if (organization.zoho_contact_id !== customer.customerId) {
    const { error } = await admin
      .from("organizations")
      .update({
        zoho_contact_id: customer.customerId,
        zoho_contact_synced_at: new Date().toISOString(),
      })
      .eq("id", organization.id);
    if (error) throw new Error(error.message);
  }

  const mode: AccountingDocumentMode = environment.ZOHO_RESERVATION_DOCUMENT_MODE;
  const issueDate = utcTimestampToIndiaDate(attempt.paid_at);
  const document = await provider.createReservationDocument({
    mode,
    externalReference: invoice.reference_number,
    orderNumber: order.order_number,
    issueDate,
    customer,
    amountPaise: attempt.amount_paise,
    currency: "INR",
    itemId: environment.ZOHO_RESERVATION_ITEM_ID!,
    taxId: environment.ZOHO_RESERVATION_TAX_ID!,
    taxMode: environment.ZOHO_RESERVATION_TAX_MODE,
    taxBasisPoints: environment.ZOHO_RESERVATION_TAX_BASIS_POINTS,
  });

  if (
    document.customerId !== customer.customerId ||
    document.issueDate !== issueDate ||
    document.totalPaise !== attempt.amount_paise
  ) {
    throw new ZohoProviderError({
      code: "ZOHO_DOCUMENT_RECONCILIATION_FAILED",
      message: `Zoho document ${document.documentId} does not reconcile to the verified PayU payment`,
      safeMessage: "The Zoho document total or customer does not match PayU. Finance review is required.",
      retryable: false,
    });
  }

  const { error: documentUpdateError } = await (invoiceTable as any)
    .update({
      zoho_contact_id: customer.customerId,
      zoho_document_id: document.documentId,
      document_number: document.documentNumber,
      issue_date: document.issueDate,
      subtotal_paise: document.subtotalPaise,
      tax_paise: document.taxPaise,
      total_paise: document.totalPaise,
      provider_status: document.status,
      provider_snapshot: document.snapshot as Json,
      tax_configuration_snapshot: {
        document_mode: mode,
        tax_id: environment.ZOHO_RESERVATION_TAX_ID,
        tax_mode: environment.ZOHO_RESERVATION_TAX_MODE,
        tax_basis_points: environment.ZOHO_RESERVATION_TAX_BASIS_POINTS ?? null,
        item_id: environment.ZOHO_RESERVATION_ITEM_ID,
      } as Json,
    })
    .eq("id", invoice.id);
  if (documentUpdateError) throw new Error(documentUpdateError.message);

  const payment = await provider.recordPayment({
    customerId: customer.customerId,
    document,
    amountPaise: attempt.amount_paise,
    paymentDate: issueDate,
    referenceNumber: `PAYU-${attempt.provider_payment_id}`.slice(0, 100),
    orderNumber: order.order_number,
  });
  if (payment.amountPaise !== attempt.amount_paise) {
    throw new ZohoProviderError({
      code: "ZOHO_PAYMENT_RECONCILIATION_FAILED",
      message: "Zoho customer payment does not equal the verified PayU amount",
      safeMessage: "The Zoho payment amount does not match PayU. Finance review is required.",
      retryable: false,
    });
  }

  const refreshedDocument = await provider.findReservationDocumentByExternalReference({
    mode,
    externalReference: invoice.reference_number,
  });
  if (
    !refreshedDocument ||
    refreshedDocument.documentId !== document.documentId ||
    refreshedDocument.customerId !== customer.customerId ||
    refreshedDocument.issueDate !== issueDate ||
    refreshedDocument.totalPaise !== attempt.amount_paise ||
    refreshedDocument.paidPaise !== attempt.amount_paise ||
    refreshedDocument.balancePaise !== 0 ||
    refreshedDocument.status.toLowerCase() !== "paid"
  ) {
    throw new ZohoProviderError({
      code: "ZOHO_DOCUMENT_REFRESH_FAILED",
      message: "The paid Zoho document could not be reloaded and reconciled",
      safeMessage: "The Zoho document could not be confirmed after payment. Finance review is required.",
      retryable: true,
    });
  }

  await provider.markOrSendDocument({ document: refreshedDocument, customerEmail });
  const pdf = await provider.downloadDocumentPdf(refreshedDocument);
  const filename = `${safeFilePart(refreshedDocument.documentNumber)}-${safeFilePart(order.order_number)}.pdf`;
  const objectKey = `organizations/${organization.id}/orders/${order.id}/invoices/${invoice.id}/${filename}`;
  const stored = await putPrivatePdf({
    objectKey,
    filename,
    bytes: pdf,
    metadata: {
      "invoice-id": invoice.id,
      "order-id": order.id,
      "zoho-document-id": refreshedDocument.documentId,
    },
  });

  let pdfFileId: string;
  const { data: existingFile, error: existingFileError } = await admin
    .from("order_files")
    .select("id")
    .eq("bucket_name", stored.bucket)
    .eq("object_key", stored.objectKey)
    .maybeSingle();
  if (existingFileError) throw new Error(existingFileError.message);
  if (existingFile) {
    pdfFileId = existingFile.id;
  } else {
    const { data: createdFile, error: fileError } = await admin
      .from("order_files")
      .insert({
        order_id: order.id,
        kind: "invoice_pdf",
        visibility: "customer",
        bucket_name: stored.bucket,
        object_key: stored.objectKey,
        original_filename: filename,
        safe_filename: filename,
        content_type: "application/pdf",
        byte_size: stored.byteSize,
        sha256: stored.sha256,
        scan_status: "not_required",
        provider_source: "zoho",
        upload_status: "finalized",
        finalized_at: new Date().toISOString(),
        object_etag: stored.etag,
      })
      .select("id")
      .single();
    if (fileError || !createdFile) throw new Error(fileError?.message ?? "Invoice PDF file row was not created");
    pdfFileId = createdFile.id;
  }

  const completedAt = new Date().toISOString();
  const { error: completeError } = await (invoiceTable as any)
    .update({
      sync_status: "completed",
      zoho_contact_id: customer.customerId,
      zoho_document_id: refreshedDocument.documentId,
      zoho_payment_id: payment.paymentId,
      document_number: refreshedDocument.documentNumber,
      issue_date: issueDate,
      subtotal_paise: refreshedDocument.subtotalPaise,
      tax_paise: refreshedDocument.taxPaise,
      total_paise: attempt.amount_paise,
      paid_paise: attempt.amount_paise,
      balance_paise: 0,
      provider_status: refreshedDocument.status,
      provider_snapshot: {
        document: refreshedDocument.snapshot,
        payment: payment.snapshot,
      } as Json,
      pdf_file_id: pdfFileId,
      emailed_at: environment.ZOHO_SEND_DOCUMENT_EMAIL ? completedAt : null,
      completed_at: completedAt,
      last_error_code: null,
      last_error_message: null,
      next_attempt_at: null,
    })
    .eq("id", invoice.id);
  if (completeError) throw new Error(completeError.message);

  const [notificationResult, auditResult] = await Promise.all([
    admin.from("notifications").insert({
      user_id: order.customer_user_id,
      organization_id: organization.id,
      order_id: order.id,
      type: "reservation_invoice_ready",
      title: "Reservation invoice ready",
      body: `${refreshedDocument.documentNumber} is available for ${order.order_number}.`,
      action_url: `/account/documents`,
    }),
    admin.from("audit_logs").insert({
      actor_type: "provider",
      action: "invoice.completed",
      target_type: "invoice",
      target_id: invoice.id,
      organization_id: organization.id,
      order_id: order.id,
      after_state: {
        provider: "zoho_invoice",
        document_id: refreshedDocument.documentId,
        document_number: refreshedDocument.documentNumber,
        payment_id: payment.paymentId,
        pdf_file_id: pdfFileId,
        total_paise: attempt.amount_paise,
      } as Json,
    }),
  ]);
  if (notificationResult.error || auditResult.error) {
    console.error("Completed invoice follow-up record failed", {
      invoiceId: invoice.id,
      notificationError: notificationResult.error?.message ?? null,
      auditError: auditResult.error?.message ?? null,
    });
  }

  return Object.freeze({
    invoiceId: invoice.id,
    documentNumber: refreshedDocument.documentNumber,
    paymentId: payment.paymentId,
    pdfFileId,
    adoptedDocument: document.adoptedExisting,
    adoptedPayment: payment.adoptedExisting,
  });
}

export async function markReservationInvoiceFailure(
  invoiceId: string,
  error: unknown,
): Promise<ZohoProviderError> {
  const providerError = asZohoProviderError(error);
  const admin = createAdminClient();
  await (admin.from("invoices") as any)
    .update({
      sync_status: providerError.retryable ? "retryable_failure" : "permanent_failure",
      last_error_code: providerError.code.slice(0, 160),
      last_error_message: providerError.safeMessage.slice(0, 2000),
      next_attempt_at: providerError.retryable
        ? new Date(Date.now() + 10 * 60 * 1000).toISOString()
        : null,
    })
    .eq("id", invoiceId);
  return providerError;
}
