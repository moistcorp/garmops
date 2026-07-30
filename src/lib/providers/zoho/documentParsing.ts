import { zohoAmountToPaise } from "@/lib/providers/zoho/money";
import type {
  AccountingDocumentMode,
  AccountingDocumentRef,
} from "@/lib/providers/zoho/types";

export function parseZohoDocument(
  mode: AccountingDocumentMode,
  raw: Record<string, unknown>,
  adoptedExisting: boolean,
): AccountingDocumentRef {
  const documentId = raw.retainerinvoice_id ?? raw.invoice_id;
  const documentNumber = raw.retainerinvoice_number ?? raw.invoice_number;
  if (
    (typeof documentId !== "string" && typeof documentId !== "number") ||
    (typeof documentNumber !== "string" && typeof documentNumber !== "number") ||
    (typeof raw.customer_id !== "string" && typeof raw.customer_id !== "number") ||
    typeof raw.date !== "string"
  ) {
    throw new Error("Zoho document response is incomplete");
  }

  const totalPaise = zohoAmountToPaise(raw.total ?? 0);
  const paidPaise = zohoAmountToPaise(raw.payment_made ?? 0);
  const balancePaise = zohoAmountToPaise(raw.balance ?? Math.max(0, totalPaise - paidPaise) / 100);
  const subtotalPaise = zohoAmountToPaise(raw.sub_total ?? raw.total ?? 0);
  const taxPaise = Math.max(0, totalPaise - subtotalPaise);

  return Object.freeze({
    provider: "zoho_invoice",
    mode,
    documentId: String(documentId),
    documentNumber: String(documentNumber),
    customerId: String(raw.customer_id),
    issueDate: raw.date,
    status: typeof raw.status === "string" ? raw.status : "unknown",
    subtotalPaise,
    taxPaise,
    totalPaise,
    paidPaise,
    balancePaise,
    adoptedExisting,
    snapshot: Object.freeze({
      id: String(documentId),
      number: String(documentNumber),
      status: typeof raw.status === "string" ? raw.status : null,
      total: raw.total ?? null,
      payment_made: raw.payment_made ?? null,
      balance: raw.balance ?? null,
      reference_number: raw.reference_number ?? null,
      is_emailed: raw.is_emailed === true,
    }),
  });
}
