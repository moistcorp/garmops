import { NextRequest, NextResponse } from "next/server";
import {
  PAYMENT_RESULT_COOKIE,
  createPaymentResultCookie,
  decodePaymentToken,
  verifyPayuResponse,
  type PaymentResultPayload,
  type PayuResponseFields,
} from "@/lib/payu";

export const runtime = "nodejs";

function redirectUrl(
  request: NextRequest,
  pathname: "/payment/success" | "/payment/failure",
  params: Record<string, string>
): URL {
  const url = new URL(pathname, request.nextUrl.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url;
}

function redirectWithResult(
  request: NextRequest,
  result: PaymentResultPayload,
  cookieValue: string
): NextResponse {
  const successful = result.status === "success";
  const response = NextResponse.redirect(
    redirectUrl(
      request,
      successful ? "/payment/success" : "/payment/failure",
      {
        txnid: result.txnid,
        ...(result.mock ? { mock: "1" } : {}),
      }
    ),
    303
  );
  response.cookies.set(PAYMENT_RESULT_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 60,
  });
  return response;
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fields: PayuResponseFields = {
      key: readString(formData, "key"),
      txnid: readString(formData, "txnid"),
      amount: readString(formData, "amount"),
      productinfo: readString(formData, "productinfo"),
      firstname: readString(formData, "firstname"),
      email: readString(formData, "email"),
      udf1: readString(formData, "udf1"),
      udf2: readString(formData, "udf2"),
      udf3: readString(formData, "udf3"),
      udf4: readString(formData, "udf4"),
      udf5: readString(formData, "udf5"),
      status: readString(formData, "status"),
      hash: readString(formData, "hash"),
      additionalCharges:
        readString(formData, "additional_charges") ||
        readString(formData, "additionalCharges"),
    };

    const payment = decodePaymentToken(fields.udf1);
    const authentic =
      payment !== null &&
      payment.txnid === fields.txnid &&
      payment.amount === fields.amount &&
      verifyPayuResponse(fields);

    if (!authentic) {
      return NextResponse.redirect(
        redirectUrl(request, "/payment/failure", {
          txnid: fields.txnid,
          error: "Payment response could not be verified",
        }),
        303
      );
    }

    const status = fields.status.toLowerCase() === "success" ? "success" : "failure";
    const result: PaymentResultPayload = { ...payment, status, mock: false };
    const cookieValue = createPaymentResultCookie(payment, status);
    if (!cookieValue) {
      return NextResponse.redirect(
        redirectUrl(request, "/payment/failure", {
          txnid: fields.txnid,
          error: "Payment verification is unavailable",
        }),
        303
      );
    }

    return redirectWithResult(request, result, cookieValue);
  } catch {
    return NextResponse.redirect(
      redirectUrl(request, "/payment/failure", {
        error: "Invalid payment response",
      }),
      303
    );
  }
}

export async function GET(request: NextRequest) {
  // The mock hand-off is deliberately available only in local development.
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payment = decodePaymentToken(request.nextUrl.searchParams.get("token") ?? "");
  if (!payment) {
    return NextResponse.redirect(
      redirectUrl(request, "/payment/failure", {
        error: "Invalid mock payment",
      }),
      303
    );
  }

  const result: PaymentResultPayload = {
    ...payment,
    status: "success",
    mock: true,
  };
  const cookieValue = createPaymentResultCookie(payment, "success", true);
  if (!cookieValue) {
    return NextResponse.redirect(
      redirectUrl(request, "/payment/failure", {
        txnid: payment.txnid,
        error: "Mock payment verification is unavailable",
      }),
      303
    );
  }

  return redirectWithResult(request, result, cookieValue);
}
