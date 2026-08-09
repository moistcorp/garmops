import { cookies } from "next/headers";

import DurablePaymentResult from "@/components/payment/DurablePaymentResult";
import PaymentResultUnavailable from "@/components/payment/PaymentResultUnavailable";
import { loadDurablePaymentResult } from "@/lib/domain/payments/loadResult";
import {
  decodeDurablePaymentResult,
  DURABLE_PAYMENT_RESULT_COOKIE,
} from "@/lib/domain/payments/result";
import { createClient } from "@/lib/supabase/server";

type PaymentResultSearch = {
  order?: string | string[];
  attempt?: string | string[];
};

export default async function PaymentFailurePage({
  searchParams,
}: {
  searchParams: Promise<PaymentResultSearch>;
}) {
  const query = await searchParams;
  const orderNumber = typeof query.order === "string" ? query.order : "";
  const attemptId = typeof query.attempt === "string" ? query.attempt : "";

  if (!orderNumber || !attemptId) {
    return <PaymentResultUnavailable />;
  }

  const cookieStore = await cookies();
  const token = decodeDurablePaymentResult(
    cookieStore.get(DURABLE_PAYMENT_RESULT_COOKIE)?.value,
  );

  if (
    !token ||
    token.orderNumber !== orderNumber ||
    token.attemptId !== attemptId
  ) {
    return <PaymentResultUnavailable />;
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return <PaymentResultUnavailable />;

  const result = await loadDurablePaymentResult(attemptId, orderNumber, userData.user.id);
  if (!result) {
    return <PaymentResultUnavailable />;
  }

  const outcome =
    result.paymentStatus === "paid"
      ? "success"
      : ["failed", "cancelled"].includes(result.paymentStatus)
        ? "failure"
        : token.outcome;

  return <DurablePaymentResult result={{ ...result, outcome }} />;
}
