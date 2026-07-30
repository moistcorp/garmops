import "server-only";

import { ZohoProviderError } from "@/lib/providers/zoho/errors";
import type {
  AccountingCustomerInput,
  AccountingCustomerRef,
  ZohoApiEnvelope,
} from "@/lib/providers/zoho/types";
import type { ZohoClient } from "@/lib/providers/zoho/client";

const markerFor = (organizationId: string) => `GARMOPS-ORG-${organizationId}`;

type ZohoContact = Readonly<{
  contact_id?: string | number;
  contact_name?: string;
  company_name?: string;
  email?: string;
  status?: string;
  gst_no?: string;
  notes?: string;
  contact_persons?: Array<{
    contact_person_id?: string | number;
    email?: string;
    is_primary_contact?: boolean;
  }>;
}>;

type ContactEnvelope = ZohoApiEnvelope & {
  contact?: ZohoContact;
  contacts?: ZohoContact[];
};

function contactId(contact: ZohoContact): string | null {
  if (typeof contact.contact_id === "string" || typeof contact.contact_id === "number") {
    return String(contact.contact_id);
  }
  return null;
}

function contactPersonIds(contact: ZohoContact): string[] {
  return (contact.contact_persons ?? [])
    .map((person) => person.contact_person_id)
    .filter((id): id is string | number => typeof id === "string" || typeof id === "number")
    .map(String);
}

function exactEmailMatch(contact: ZohoContact, email: string): boolean {
  const normalized = email.toLowerCase();
  return contact.email?.toLowerCase() === normalized ||
    (contact.contact_persons ?? []).some((person) => person.email?.toLowerCase() === normalized);
}

function safeMatch(contact: ZohoContact, input: AccountingCustomerInput): boolean {
  if (contact.status && contact.status.toLowerCase() === "inactive") return false;
  const marker = markerFor(input.organizationId);
  if (contact.notes?.includes(marker)) return true;
  if (!exactEmailMatch(contact, input.email)) return false;
  if (input.gstin && contact.gst_no && input.gstin.toUpperCase() !== contact.gst_no.toUpperCase()) {
    return false;
  }
  const expectedNames = new Set([
    input.legalName.trim().toLowerCase(),
    input.displayName.trim().toLowerCase(),
  ]);
  return expectedNames.has((contact.contact_name ?? "").trim().toLowerCase()) ||
    expectedNames.has((contact.company_name ?? "").trim().toLowerCase());
}

async function retrieveContact(client: ZohoClient, id: string): Promise<ZohoContact | null> {
  try {
    const response = await client.json<ContactEnvelope>(`contacts/${encodeURIComponent(id)}`);
    return response.contact ?? null;
  } catch (error) {
    if (error instanceof ZohoProviderError && (error.status === 404 || error.code === "ZOHO_1002")) {
      return null;
    }
    throw error;
  }
}

async function searchContacts(
  client: ZohoClient,
  input: AccountingCustomerInput,
): Promise<ZohoContact[]> {
  const unique = new Map<string, ZohoContact>();
  const queries = [
    new URLSearchParams({ search_text: markerFor(input.organizationId), per_page: "200" }),
    new URLSearchParams({ email_contains: input.email, per_page: "200" }),
  ];

  for (const query of queries) {
    const response = await client.json<ContactEnvelope>("contacts", { query });
    for (const contact of response.contacts ?? []) {
      const id = contactId(contact);
      if (id) unique.set(id, contact);
    }
  }
  return [...unique.values()].filter((contact) => safeMatch(contact, input));
}

export async function ensureZohoCustomer(
  client: ZohoClient,
  input: AccountingCustomerInput,
): Promise<AccountingCustomerRef> {
  if (input.existingProviderId) {
    const existing = await retrieveContact(client, input.existingProviderId);
    if (existing && safeMatch(existing, input)) {
      return Object.freeze({
        provider: "zoho_invoice",
        customerId: input.existingProviderId,
        contactPersonIds: contactPersonIds(existing),
        adoptedExisting: true,
      });
    }
  }

  const matches = await searchContacts(client, input);
  if (matches.length > 1) {
    throw new ZohoProviderError({
      code: "ZOHO_AMBIGUOUS_CONTACT",
      message: `Multiple Zoho contacts match organization ${input.organizationId}`,
      safeMessage: "Multiple accounting contacts match this company. Finance review is required.",
      retryable: false,
    });
  }
  if (matches.length === 1) {
    const matched = matches[0];
    if (!matched) throw new Error("Zoho contact match is unavailable");
    const id = contactId(matched);
    if (!id) throw new Error("Zoho contact has no identifier");
    return Object.freeze({
      provider: "zoho_invoice",
      customerId: id,
      contactPersonIds: contactPersonIds(matched),
      adoptedExisting: true,
    });
  }

  const billing = input.billingAddress;
  const response = await client.json<ContactEnvelope>("contacts", {
    method: "POST",
    body: {
      contact_name: input.legalName,
      company_name: input.displayName,
      contact_type: "customer",
      website: input.website || undefined,
      gst_treatment: input.gstin ? "business_gst" : "business_none",
      gst_no: input.gstin || undefined,
      notes: `${markerFor(input.organizationId)}\nCreated by Garmops order automation.`,
      billing_address: {
        attention: billing.attention || input.displayName,
        address: billing.address,
        street2: billing.street2 || undefined,
        city: billing.city,
        state: billing.state,
        zip: billing.zip,
        country: billing.country,
        phone: billing.phone || input.phone || undefined,
      },
      contact_persons: [
        {
          first_name: input.firstName || input.displayName,
          last_name: input.lastName || "",
          email: input.email,
          phone: input.phone || undefined,
          is_primary_contact: true,
        },
      ],
    },
  });

  const created = response.contact;
  if (!created) {
    throw new ZohoProviderError({
      code: "ZOHO_CONTACT_RESPONSE_INVALID",
      message: "Zoho contact creation response did not include a contact",
      safeMessage: "Zoho created an incomplete customer record. Finance review is required.",
      retryable: true,
    });
  }
  const id = contactId(created);
  if (!id) {
    throw new ZohoProviderError({
      code: "ZOHO_CONTACT_RESPONSE_INVALID",
      message: "Zoho contact creation response did not include an ID",
      safeMessage: "Zoho created an incomplete customer record. Finance review is required.",
      retryable: true,
    });
  }
  return Object.freeze({
    provider: "zoho_invoice",
    customerId: id,
    contactPersonIds: contactPersonIds(created),
    adoptedExisting: false,
  });
}
