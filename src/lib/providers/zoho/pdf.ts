import "server-only";

import type { ZohoClient } from "@/lib/providers/zoho/client";
import type { AccountingDocumentRef } from "@/lib/providers/zoho/types";

export async function downloadZohoDocumentPdf(
  client: ZohoClient,
  document: AccountingDocumentRef,
): Promise<Uint8Array> {
  const collection = document.mode === "retainer_invoice" ? "retainerinvoices" : "invoices";
  return client.binary(
    `${collection}/${encodeURIComponent(document.documentId)}`,
    new URLSearchParams({ accept: "pdf" }),
  );
}
