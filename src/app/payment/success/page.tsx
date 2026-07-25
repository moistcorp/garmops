import { cookies } from "next/headers";
import {
  PAYMENT_RESULT_COOKIE,
  decodePaymentResultCookie,
} from "@/lib/payu";
import PaymentSuccessClient from "./PaymentSuccessClient";

interface PaymentSuccessPageProps {
  searchParams: Promise<{ txnid?: string | string[] }>;
}

export default async function PaymentSuccessPage({
  searchParams,
}: PaymentSuccessPageProps) {
  const query = await searchParams;
  const txnid = typeof query.txnid === "string" ? query.txnid : "";
  const cookieValue = (await cookies()).get(PAYMENT_RESULT_COOKIE)?.value;
  const payment = decodePaymentResultCookie(cookieValue);
  const verified =
    payment?.status === "success" &&
    payment.txnid === txnid;

  return (
    <PaymentSuccessClient
      verified={verified}
      txnid={txnid}
      paymentKind={verified ? payment.kind : null}
      isMockPayment={verified ? payment.mock : false}
    />
  );
}
