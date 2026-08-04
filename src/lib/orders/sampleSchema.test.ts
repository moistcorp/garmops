import { describe, expect, it } from "vitest";

import { submitSampleOrderRequestSchema } from "./sampleSchema";

const validRequest = {
  items: [{ productId: 1, size: "M", quantity: 2 }],
  contact: {
    firstName: "Dhananjay",
    lastName: "Singh",
    email: "buyer@example.com",
    phone: "+919876543210",
  },
  shipping: {
    recipientName: "Dhananjay Singh",
    address: {
      country: "India" as const,
      addressLine1: "12 Factory Road",
      addressLine2: "Industrial Area",
      zip: "110001",
      city: "New Delhi",
      state: "Delhi",
    },
  },
  acceptedTerms: true as const,
  idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
};

describe("durable sample-order request validation", () => {
  it("accepts a complete India sample checkout", () => {
    const parsed = submitSampleOrderRequestSchema.parse(validRequest);
    expect(parsed.contact.email).toBe("buyer@example.com");
    expect(parsed.items[0]).toEqual({ productId: 1, size: "M", quantity: 2 });
  });

  it("requires explicit terms acceptance and valid catalogue quantities", () => {
    expect(
      submitSampleOrderRequestSchema.safeParse({
        ...validRequest,
        acceptedTerms: false,
      }).success,
    ).toBe(false);
    expect(
      submitSampleOrderRequestSchema.safeParse({
        ...validRequest,
        items: [{ productId: 1, size: "M", quantity: 0 }],
      }).success,
    ).toBe(false);
  });

  it("rejects non-Indian or incomplete delivery snapshots", () => {
    expect(
      submitSampleOrderRequestSchema.safeParse({
        ...validRequest,
        shipping: {
          ...validRequest.shipping,
          address: { ...validRequest.shipping.address, zip: "000000" },
        },
      }).success,
    ).toBe(false);
  });
});
