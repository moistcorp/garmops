import { describe, expect, it } from "vitest";

import {
  addressMutation,
  companyDetailsSchema,
  savedAddressSchema,
} from "./companyDetails";

describe("company details validation", () => {
  it("normalizes company GSTIN values", () => {
    expect(
      companyDetailsSchema.parse({
        companyName: "Acme India",
        gstin: "29abcde1234f1z5",
      }),
    ).toEqual({ companyName: "Acme India", gstin: "29ABCDE1234F1Z5" });
  });

  it("rejects an invalid Indian billing PIN code", () => {
    expect(
      savedAddressSchema.safeParse({
        line1: "12 Test Street",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "000001",
      }).success,
    ).toBe(false);
  });

  it("creates a reusable organization address record", () => {
    const input = savedAddressSchema.parse({
      label: "Head office",
      contactName: "Buyer Name",
      phone: "9876543210",
      line1: "12 Test Street",
      line2: "Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      useAsShipping: "on",
    });

    expect(addressMutation(input)).toMatchObject({
      phone: "+919876543210",
      postal_code: "560001",
      country_code: "IN",
    });
    expect(input.useAsShipping).toBe(true);
  });
});
