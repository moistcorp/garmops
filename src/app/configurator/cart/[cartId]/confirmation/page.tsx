import Link from "next/link";
import { CreditCard } from "lucide-react";
import { redirect } from "next/navigation";
import { ConfirmationStep } from "@/components/configurator/cart/ConfirmationStep";
import { isFeatureEnabled } from "@/lib/config/featureFlags";
import { requireCustomer } from "@/lib/auth/guards";

export default async function ConfirmationPage({ params, searchParams }: { params: Promise<{ cartId: string }>; searchParams: Promise<{ payment?: string; checkoutAttempt?: string }> }) {
  const [{ cartId }, query] = await Promise.all([params, searchParams]);
  if (!isFeatureEnabled("CONFIGURATOR_CHECKOUT_ENABLED")) return <main className="techpack-cart-page techpack-studio-bg min-h-screen px-4 py-10"><div className="mx-auto flex min-h-[70vh] max-w-xl items-center"><section className="techpack-surface w-full rounded-sm border p-7 text-center"><CreditCard size={42} className="mx-auto text-amber-600"/><h1 className="mt-2 text-2xl font-semibold">Online checkout is unavailable</h1><Link href={`/configurator/cart/${encodeURIComponent(cartId)}/shipping`} className="mt-7 inline-flex rounded-sm bg-(--color-accent) px-5 py-3 text-sm font-semibold text-white">Return to order details</Link></section></div></main>;
  try { await requireCustomer(`/configurator/cart/${cartId}/confirmation`); } catch { redirect(`/configurator/cart/${encodeURIComponent(cartId)}/shipping`); }
  const paymentOutcome = query.payment === "failure" || query.payment === "pending" ? query.payment : undefined;
  return <main className="techpack-cart-page techpack-studio-bg min-h-screen px-4 pb-8"><div className="mx-auto max-w-6xl"><ConfirmationStep cartId={cartId} paymentOutcome={paymentOutcome} checkoutAttemptId={query.checkoutAttempt}/></div></main>;
}
