import { cookies } from "next/headers";

import { isFeatureEnabled } from "@/lib/config/featureFlags";
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
import PaymentFailureClient from "./PaymentFailureClient";

type PaymentFailureSearch = {
  txnid?: string | string[];
  error?: string | string[];
  order?: string | string[];
  attempt?: string | string[];
};

export default async function PaymentFailurePage({
  searchParams,
}: {
  searchParams: Promise<PaymentFailureSearch>;
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

  // Legacy configurator fallback only. Durable sample checkout never reads browser order data.
  const transactionId =
    typeof query.txnid === "string" ? query.txnid : "";
  const error = typeof query.error === "string" ? query.error : "";
  const payment = decodePaymentResultCookie(
    cookieStore.get(PAYMENT_RESULT_COOKIE)?.value,
  );
  const verified =
    payment?.status === "failure" &&
    payment.mock === false &&
    payment.txnid === transactionId &&
    !(payment.kind === "sample-cart" && isFeatureEnabled("DURABLE_SAMPLE_CHECKOUT_ENABLED"));
  return (
    <PaymentFailureClient
      verified={verified}
      txnid={transactionId}
      error={error}
      paymentKind={verified ? payment.kind : null}
      supportEmail={process.env.CONTACT_TO_EMAIL ?? "hello@garmops.com"}
    />
  );
}
