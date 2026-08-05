import { describe, expect, it } from "vitest";

import {
  orderNumberSchema,
  submitCustomOrderRequestSchema,
} from "./schema";

function validSubmission() {
  const address = {
    country: "India" as const,
    addressLine1: "14 Knowledge Park",
    zip: "201310",
    city: "Greater Noida",
    state: "Uttar Pradesh",
  };
  return {
    items: [
      {
        cartItemId: "cart-line-1",
        designProjectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        designVersion: 2,
        sizeQuantities: { XS: 5, S: 10, M: 15, L: 10, XL: 5, XXL: 5 },
      },
      {
        cartItemId: "cart-line-2",
        designProjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        designVersion: 1,
        sizeQuantities: { XS: 5, S: 10, M: 15, L: 10, XL: 5, XXL: 5 },
      },
    ],
    deliveryType: "standard" as const,
    requestedDeliveryDate: "2026-09-15",
    projectName: "Autumn team merchandise",
    contact: {
      firstName: "Asha",
      lastName: "Mehta",
      email: "asha@example.com",
      phone: "+919810000001",
    },
    shipping: {
      recipientName: "Asha Mehta",
      address,
      multipleLocations: false,
    },
    billing: {
      entity: "Alpha Events Private Limited",
      address,
      accountsPayableEmail: "accounts@example.com",
    },
    acceptedTerms: true as const,
    acceptedTermsVersion: "terms-v1",
    acceptedPrivacyVersion: "privacy-v1",
    idempotencyKey: "70000000-0000-4000-8000-000000000001",
  };
}

describe("custom order submission schema", () => {
  it("accepts a complete immutable-design submission", () => {
    expect(submitCustomOrderRequestSchema.safeParse(validSubmission()).success)
      .toBe(true);
  });


  it("rejects duplicate cart line identities while allowing repeated products", () => {
    const input = validSubmission();
    expect(
      submitCustomOrderRequestSchema.safeParse({
        ...input,
        items: [input.items[0], { ...input.items[1], cartItemId: input.items[0].cartItemId }],
      }).success,
    ).toBe(false);
  });

  it("rejects a submission without accepted terms", () => {
    expect(
      submitCustomOrderRequestSchema.safeParse({
        ...validSubmission(),
        acceptedTerms: false,
      }).success,
    ).toBe(false);
  });

  it("rejects invalid Indian delivery addresses", () => {
    const input = validSubmission();
    expect(
      submitCustomOrderRequestSchema.safeParse({
        ...input,
        shipping: {
          ...input.shipping,
          address: { ...input.shipping.address, zip: "012345" },
        },
      }).success,
    ).toBe(false);
  });

  it("accepts durable custom and sample order numbers", () => {
    expect(orderNumberSchema.safeParse("GAR-2026-000184").success).toBe(true);
    expect(orderNumberSchema.safeParse("SAM-2026-000184").success).toBe(true);
    expect(orderNumberSchema.safeParse("ORD-2026-000184").success).toBe(false);
    expect(orderNumberSchema.safeParse("../GAR-2026-000184").success).toBe(
      false,
    );
  });
});
