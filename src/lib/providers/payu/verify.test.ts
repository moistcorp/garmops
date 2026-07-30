import { describe, expect, it } from "vitest";

import { parsePayuVerificationResponse } from "./verificationResult";

describe("PayU verification response parsing", () => {
  it("accepts only a captured success with an exact transaction", () => {
    const result = parsePayuVerificationResponse(
      {
        status: 1,
        msg: "Transaction Fetched Successfully",
        transaction_details: {
          TXN12345: {
            txnid: "TXN12345",
            mihpayid: "403993715530000001",
            status: "success",
            unmappedstatus: "captured",
            amt: "499.00",
          },
        },
      },
      "TXN12345",
    );

    expect(result.status).toBe("success");
    expect(result.amountPaise).toBe(49_900);
    expect(result.providerPaymentId).toBe("403993715530000001");
  });

  it("keeps an incomplete provider success pending", () => {
    const result = parsePayuVerificationResponse(
      {
        transaction_details: {
          TXN12345: {
            txnid: "TXN12345",
            status: "success",
            unmappedstatus: "",
            amt: "499.00",
          },
        },
      },
      "TXN12345",
    );

    expect(result.status).toBe("pending");
  });

  it("treats not-found IDs as absent and does not invent success", () => {
    const result = parsePayuVerificationResponse(
      {
        status: 0,
        transaction_details: {
          TXN12345: {
            txnid: "TXN12345",
            mihpayid: "Not Found",
            status: "Not Found",
          },
        },
      },
      "TXN12345",
    );

    expect(result.status).toBe("unknown");
    expect(result.providerPaymentId).toBeNull();
  });

  it("rejects a response that identifies another merchant transaction", () => {
    expect(() =>
      parsePayuVerificationResponse(
        {
          transaction_details: {
            TXN12345: {
              txnid: "OTHER12345",
              status: "success",
              unmappedstatus: "captured",
              amt: "499.00",
            },
          },
        },
        "TXN12345",
      ),
    ).toThrow(/different transaction id/i);
  });
});
