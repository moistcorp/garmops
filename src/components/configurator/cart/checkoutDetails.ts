import {
  getAddressMissingFields,
  isEmailValid,
  isIndianPhoneValid,
  type Address,
} from "./AddressForm";

export const INDUSTRIES = [
  "Hotels & Restaurants",
  "Music & Events",
  "Sports & Fitness",
  "Arts & Culture",
  "Creative Studios",
  "Companies & Startups",
  "Other",
] as const;

export const PROJECT_DEPARTMENTS = [
  "HR",
  "Operations",
  "Marketing",
  "Procurement",
  "Founder",
  "Other",
] as const;

export type Industry = (typeof INDUSTRIES)[number] | "";
export type ProjectDepartment = (typeof PROJECT_DEPARTMENTS)[number] | "";

export interface CompanyInformation {
  name: string;
  gstin: string;
  industry: Industry;
  website: string;
  poNumber: string;
  costCentre: string;
  address: Address;
}

export interface ProjectContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: ProjectDepartment;
}

export interface ShippingInformation {
  recipientName: string;
  address: Address;
  multipleLocations: boolean;
  multipleLocationsNotes: string;
}

export interface PurchaseOrderAttachment {
  fileKey: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface BillingInformation {
  sameAsCompanyAddress: boolean;
  entity: string;
  address: Address;
  accountsPayableEmail: string;
  gstin: string;
  purchaseOrder?: PurchaseOrderAttachment;
}

export interface ProjectPreferences {
  orderNotes: string;
  receiveEmails: boolean;
}

export interface MissingCheckoutField {
  key: string;
  label: string;
  section: "company" | "contact" | "shipping" | "billing";
}

function addressFields(
  address: Address,
  section: MissingCheckoutField["section"],
  prefix: string
): MissingCheckoutField[] {
  const sectionLabel = section === "shipping" ? "shipping" : section === "billing" ? "billing" : "company";
  return getAddressMissingFields(address).map((field) => ({
    key: `${prefix}.${field.key}`,
    label: `${sectionLabel} ${field.label}`,
    section,
  }));
}

export function isGstinValid(value: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
    value.trim().toUpperCase(),
  );
}

export function getCompanyMissingFields(_company: CompanyInformation): MissingCheckoutField[] {
  return [];
}

export function getContactMissingFields(contact: ProjectContact): MissingCheckoutField[] {
  const missing: MissingCheckoutField[] = [];
  if (!contact.firstName.trim()) missing.push({ key: "contact.firstName", label: "contact first name", section: "contact" });
  if (!contact.lastName.trim()) missing.push({ key: "contact.lastName", label: "contact last name", section: "contact" });
  if (!isEmailValid(contact.email)) missing.push({ key: "contact.email", label: "email", section: "contact" });
  if (!isIndianPhoneValid(contact.phone)) missing.push({ key: "contact.phone", label: "phone number", section: "contact" });
  return missing;
}

export function getShippingMissingFields(shipping: ShippingInformation): MissingCheckoutField[] {
  const missing: MissingCheckoutField[] = [];
  if (!shipping.recipientName.trim()) {
    missing.push({ key: "shipping.recipientName", label: "shipping recipient", section: "shipping" });
  }
  missing.push(...addressFields(shipping.address, "shipping", "shipping.address"));
  return missing;
}

export function getBillingMissingFields(
  billing: BillingInformation,
): MissingCheckoutField[] {
  const missing: MissingCheckoutField[] = [];
  if (!billing.sameAsCompanyAddress) {
    missing.push(...addressFields(billing.address, "billing", "billing.address"));
  }
  if (billing.gstin.trim() && !isGstinValid(billing.gstin)) {
    missing.push({ key: "billing.gstin", label: "valid GSTIN", section: "billing" });
  }
  return missing;
}

export function getProcurementMissingFields(details: {
  company: CompanyInformation;
  contact: ProjectContact;
  shipping: ShippingInformation;
  billing: BillingInformation;
}): MissingCheckoutField[] {
  return [
    ...getCompanyMissingFields(details.company),
    ...getContactMissingFields(details.contact),
    ...getShippingMissingFields(details.shipping),
    ...getBillingMissingFields(details.billing),
  ];
}
