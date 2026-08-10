import { after, NextRequest, NextResponse } from "next/server";

import { processPayuEvent } from "@/lib/domain/payments/processPayuEvent";
import { processIntegrationJobsWithHealth } from "@/lib/jobs/run";
import type { PayuIncomingFields } from "@/lib/providers/payu/types";
import {
  readBoundedJson,
  readBoundedUrlEncoded,
} from "@/lib/http/requestBody";
import { requestIdFrom, withRequestId } from "@/lib/http/requestId";
import { captureOperationalError } from "@/lib/monitoring/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readPayload(request: NextRequest): Promise<PayuIncomingFields> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0];
  let source: Record<string, unknown>;
  if (contentType === "application/json") {
    const parsed = await readBoundedJson(request, 64 * 1024);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Invalid webhook JSON payload");
    }
    source = parsed as Record<string, unknown>;
  } else if (contentType === "application/x-www-form-urlencoded") {
    source = Object.fromEntries(
      await readBoundedUrlEncoded(request, 64 * 1024),
    );
  } else {
    throw new Error("Unsupported webhook content type");
  }

  const read = (key: string) =>
    typeof source[key] === "string" || typeof source[key] === "number"
      ? String(source[key])
      : "";

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

export async function POST(request: NextRequest) {
  const requestId = requestIdFrom(request);
  try {
    const result = await processPayuEvent(
      "webhook",
      await readPayload(request),
    );
    if (result.outcome === "success") {
      after(async () => {
        await processIntegrationJobsWithHealth({ triggerSource: "system", batchSize: 10 }).catch((error) => {
          console.error("Post-payment integration processing failed", { error: error instanceof Error ? error.message : "unknown" });
        });
      });
    }
    return withRequestId(NextResponse.json({ ok: true, duplicate: result.duplicate }), requestId);
  } catch (error) {
    captureOperationalError(error, { area: "payu_webhook", requestId });
    console.error("PayU webhook rejected", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return withRequestId(NextResponse.json({ ok: false }, { status: 400 }), requestId);
  }
}
