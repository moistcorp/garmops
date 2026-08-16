import PaymentStatusClient from "./PaymentStatusClient";

export default async function PaymentStatusPage({ searchParams }: { searchParams: Promise<{ cartId?: string; txnid?: string }> }) {
  const params = await searchParams;
  return <PaymentStatusClient cartId={params.cartId ?? ""} txnid={params.txnid} />;
}
