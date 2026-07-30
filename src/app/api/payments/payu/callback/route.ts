import { NextRequest, NextResponse } from "next/server";

import {
  createDurablePaymentResult,
  DURABLE_PAYMENT_RESULT_COOKIE,
} from "@/lib/domain/payments/result";
import { processPayuEvent } from "@/lib/domain/payments/processPayuEvent";
import { getServerEnvironment } from "@/lib/config/env";
import { isFeatureEnabled } from "@/lib/config/featureFlags";
import type { PayuIncomingFields } from "@/lib/providers/payu/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readForm(request: NextRequest): Promise<PayuIncomingFields> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0];
  if (contentType !== "application/x-www-form-urlencoded") {
    throw new Error("Unsupported PayU callback content type");
  }

  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.byteLength > 64 * 1024) {
    throw new Error("PayU callback is too large");
  }

  const params = new URLSearchParams(bytes.toString("utf8"));
  const read = (key: string) => params.get(key) ?? "";
  return {
    key: read("key"),
    txnid: read("txnid"),
    amount: read("amount"),
    productinfo: read("productinfo"),
    firstname: read("firstname"),
    email: read("email"),
    udf1: read("udf1"),
    udf2: read("udf2"),
    udf3: read("udf3"),
    udf4: read("udf4"),
    udf5: read("udf5"),
    status: read("status"),
    hash: read("hash"),
    mihpayid: read("mihpayid"),
    unmappedstatus: read("unmappedstatus"),
    error: read("error"),
    error_Message: read("error_Message"),
    additional_charges:
      read("additional_charges") || read("additionalCharges"),
    splitInfo: read("splitInfo"),
  };
}

function resultRedirect(
  path: string,
  orderNumber?: string,
  attemptId?: string,
  outcome: "success" | "failure" | "pending" = "failure",
) {
  const url = new URL(path, getServerEnvironment().NEXT_PUBLIC_APP_URL);
  if (orderNumber) url.searchParams.set("order", orderNumber);
  if (attemptId) url.searchParams.set("attempt", attemptId);

  const response = NextResponse.redirect(url, 303);
  if (orderNumber && attemptId) {
    response.cookies.set(
      DURABLE_PAYMENT_RESULT_COOKIE,
      createDurablePaymentResult({ attemptId, orderNumber, outcome }),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/payment",
        maxAge: 60 * 60,
      },
    );
  }
  return response;
}

export async function POST(request: NextRequest) {
  if (!isFeatureEnabled("DURABLE_CUSTOM_CHECKOUT_ENABLED")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const result = await processPayuEvent("callback", await readForm(request));
    const path =
      result.outcome === "failure"
        ? "/payment/failure"
        : "/payment/success";
    return resultRedirect(
      path,
      result.orderNumber,
      result.attemptId,
      result.outcome,
    );
  } catch (error) {
    console.error("PayU callback rejected", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return resultRedirect("/payment/failure");
  }
}
