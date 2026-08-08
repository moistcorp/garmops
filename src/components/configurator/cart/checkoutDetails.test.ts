import { describe, expect, it } from "vitest";

import {
  getBillingMissingFields,
  getContactMissingFields,
  getProcurementMissingFields,
  type BillingInformation,
  type ProjectContact,
  type ShippingInformation,
} from "./checkoutDetails";

const contact: ProjectContact = {
  firstName: "Dhananjay",
  lastName: "",
  email: "customer@example.com",
  phone: "98765 43210",
  department: "",
};

const address = {
  country: "India",
  addressLine1: "Sector 62",
  addressLine2: "",
  zip: "201301",
  city: "Noida",
  state: "Uttar Pradesh",
};

const shipping: ShippingInformation = {
  recipientName: "Dhananjay",
  company: "",
  address,
  multipleLocations: false,
  multipleLocationsNotes: "",
};

const personalBilling: BillingInformation = {
  sameAsCompanyAddress: true,
  entity: "",
  address,
  accountsPayableEmail: "customer@example.com",
  gstin: "",
};

describe("Delivery checkout details", () => {
  it("accepts a personal customer without a surname, company, or GST details", () => {
    expect(getContactMissingFields(contact)).toEqual([]);
    expect(getBillingMissingFields(personalBilling)).toEqual([]);
    expect(getProcurementMissingFields({ contact, shipping, billing: personalBilling })).toEqual([]);
  });

  it("requires a legal business name when a GSTIN is supplied", () => {
    expect(getBillingMissingFields({
      ...personalBilling,
      gstin: "09ABCDE1234F1Z5",
    })).toEqual([
      { key: "billing.entity", label: "legal business name", section: "billing" },
    ]);
  });

  it("rejects malformed GST details without making GST mandatory", () => {
    expect(getBillingMissingFields({
      ...personalBilling,
      entity: "Example India Private Limited",
      gstin: "09ABCDE1234F1Z",
    })).toEqual([
      { key: "billing.gstin", label: "valid GSTIN", section: "billing" },
    ]);
  });
});
