export type AccountingDocumentMode = "retainer_invoice" | "standard_invoice";

export type AccountingAddressInput = Readonly<{
  attention?: string | null;
  address: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string | null;
}>;

export type AccountingCustomerInput = Readonly<{
  organizationId: string;
  existingProviderId?: string | null;
  legalName: string;
  displayName: string;
  email: string;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  gstin?: string | null;
  website?: string | null;
  billingAddress: AccountingAddressInput;
}>;

export type AccountingCustomerRef = Readonly<{
  provider: "zoho_invoice";
  customerId: string;
  contactPersonIds: readonly string[];
  adoptedExisting: boolean;
}>;

export type ReservationDocumentInput = Readonly<{
  mode: AccountingDocumentMode;
  externalReference: string;
  orderNumber: string;
  issueDate: string;
  customer: AccountingCustomerRef;
  amountPaise: number;
  currency: "INR";
  itemId: string;
  taxId: string;
  taxMode: "inclusive" | "exclusive";
  taxBasisPoints?: number | null;
  placeOfSupply?: string | null;
  templateId?: string | null;
}>;

export type AccountingDocumentRef = Readonly<{
  provider: "zoho_invoice";
  mode: AccountingDocumentMode;
  documentId: string;
  documentNumber: string;
  customerId: string;
  issueDate: string;
  status: string;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  paidPaise: number;
  balancePaise: number;
  adoptedExisting: boolean;
  snapshot: Readonly<Record<string, unknown>>;
}>;

export type ExternalReferenceInput = Readonly<{
  mode: AccountingDocumentMode;
  externalReference: string;
}>;

export type AccountingPaymentInput = Readonly<{
  customerId: string;
  document: AccountingDocumentRef;
  amountPaise: number;
  paymentDate: string;
  referenceNumber: string;
  orderNumber: string;
}>;

export type AccountingPaymentRef = Readonly<{
  provider: "zoho_invoice";
  paymentId: string;
  amountPaise: number;
  referenceNumber: string;
  adoptedExisting: boolean;
  snapshot: Readonly<Record<string, unknown>>;
}>;

export type AccountingDocumentActionInput = Readonly<{
  document: AccountingDocumentRef;
  customerEmail: string;
}>;

export interface AccountingProvider {
  ensureCustomer(input: AccountingCustomerInput): Promise<AccountingCustomerRef>;
  createReservationDocument(input: ReservationDocumentInput): Promise<AccountingDocumentRef>;
  recordPayment(input: AccountingPaymentInput): Promise<AccountingPaymentRef>;
  markOrSendDocument(input: AccountingDocumentActionInput): Promise<void>;
  downloadDocumentPdf(input: AccountingDocumentRef): Promise<Uint8Array>;
  findReservationDocumentByExternalReference(
    input: ExternalReferenceInput,
  ): Promise<AccountingDocumentRef | null>;
}

export type ZohoApiEnvelope = Readonly<{
  code?: number;
  message?: string;
  [key: string]: unknown;
}>;
