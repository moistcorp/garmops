import { cookies } from "next/headers";
import {
  PAYMENT_RESULT_COOKIE,
  decodePaymentResultCookie,
} from "@/lib/payu";
import PaymentFailureClient from "./PaymentFailureClient";

interface PaymentFailurePageProps {
  searchParams: Promise<{
    txnid?: string | string[];
    error?: string | string[];
  }>;
}

export default async function PaymentFailurePage({
  searchParams,
}: PaymentFailurePageProps) {
  const query = await searchParams;
  const txnid = typeof query.txnid === "string" ? query.txnid : "";
  const error = typeof query.error === "string" ? query.error : "";
  const cookieValue = (await cookies()).get(PAYMENT_RESULT_COOKIE)?.value;
  const payment = decodePaymentResultCookie(cookieValue);
  const verified =
    payment?.status === "failure" &&
    payment.mock === false &&
    payment.txnid === txnid;

  return (
    <PaymentFailureClient
      verified={verified}
      txnid={txnid}
      error={error}
      paymentKind={verified ? payment.kind : null}
      supportEmail={process.env.CONTACT_TO_EMAIL ?? "hello@garmops.com"}
    />
  );
}
