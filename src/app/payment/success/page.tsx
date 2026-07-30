import { cookies } from "next/headers";

import DurablePaymentResult from "@/components/payment/DurablePaymentResult";
import { loadDurablePaymentResult } from "@/lib/domain/payments/loadResult";
import {
  decodeDurablePaymentResult,
  DURABLE_PAYMENT_RESULT_COOKIE,
} from "@/lib/domain/payments/result";
import {
  decodePaymentResultCookie,
  PAYMENT_RESULT_COOKIE,
} from "@/lib/payu";
import PaymentSuccessClient from "./PaymentSuccessClient";

type PaymentSuccessSearch = {
  txnid?: string | string[];
  order?: string | string[];
  attempt?: string | string[];
};

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<PaymentSuccessSearch>;
}) {
  const query = await searchParams;
  const cookieStore = await cookies();
  const orderNumber = typeof query.order === "string" ? query.order : "";
  const attemptId = typeof query.attempt === "string" ? query.attempt : "";

  if (orderNumber && attemptId) {
    const token = decodeDurablePaymentResult(
      cookieStore.get(DURABLE_PAYMENT_RESULT_COOKIE)?.value,
    );
    if (
      token &&
      token.orderNumber === orderNumber &&
      token.attemptId === attemptId
    ) {
      const result = await loadDurablePaymentResult(attemptId, orderNumber);
      if (result) {
        const outcome =
          result.paymentStatus === "paid"
            ? "success"
            : ["failed", "cancelled"].includes(result.paymentStatus)
              ? "failure"
              : token.outcome;
        return <DurablePaymentResult result={{ ...result, outcome }} />;
      }
    }
  }

  // Retained for the sample-cart flow until its durable migration in Phase 12.
  const transactionId =
    typeof query.txnid === "string" ? query.txnid : "";
  const payment = decodePaymentResultCookie(
    cookieStore.get(PAYMENT_RESULT_COOKIE)?.value,
  );
  const verified =
    payment?.status === "success" && payment.txnid === transactionId;
  return (
    <PaymentSuccessClient
      verified={verified}
      txnid={transactionId}
      paymentKind={verified ? payment.kind : null}
      isMockPayment={verified ? payment.mock : false}
    />
  );
}
