import { redirect } from "next/navigation";
export default async function OrderConfirmationPage({ params }: { params: Promise<{ orderNumber: string }> }) { redirect(`/account/orders/${encodeURIComponent((await params).orderNumber)}`); }
