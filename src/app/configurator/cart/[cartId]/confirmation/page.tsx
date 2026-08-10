import Link from "next/link";
import { CreditCard } from "lucide-react";
import { redirect } from "next/navigation";
import { ConfirmationStep } from "@/components/configurator/cart/ConfirmationStep";
import { isFeatureEnabled } from "@/lib/config/featureFlags";
import { createClient } from "@/lib/supabase/server";

interface ConfirmationPageProps {
  params: Promise<{ cartId: string }>;
  searchParams: Promise<{ payment?: string; checkoutAttempt?: string }>;
}
async function hasAuthenticatedCustomer(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user?.email || !user.email_confirmed_at) return false;
    const { data: principal } = await supabase.from("account_principals").select("account_type, active").eq("user_id", user.id).maybeSingle();
    return principal?.account_type === "customer" && principal.active;
  } catch {
    return false;
  }
}

export default async function ConfirmationPage({ params, searchParams }: ConfirmationPageProps) {
  const [{ cartId }, query] = await Promise.all([params, searchParams]);
  const paymentOutcome = query.payment === "failure" || query.payment === "pending" ? query.payment : undefined;
  const checkoutAttemptId = /^[0-9a-f-]{36}$/i.test(query.checkoutAttempt ?? "") ? query.checkoutAttempt : undefined;

  if (!isFeatureEnabled("CONFIGURATOR_CHECKOUT_ENABLED")) {
    return (
      <main className="techpack-cart-page techpack-studio-bg min-h-screen px-4 py-10">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center">
          <section className="techpack-surface w-full rounded-[4px] border p-7 text-center sm:p-10">
            <CreditCard size={42} className="mx-auto text-amber-600" aria-hidden="true" />
            <p className="mt-6 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">Checkout notice</p>
            <h1 className="mt-2 text-2xl font-semibold">Online checkout is unavailable</h1>
            <p className="mt-3 text-sm leading-relaxed text-black/55">Your configuration remains saved in this browser. Online order creation is temporarily disabled, so no payment has been started.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href={`/configurator/cart/${encodeURIComponent(cartId)}/shipping`} className="rounded-[4px] bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white">Return to order details</Link>
              <Link href="/account/orders" className="rounded-[4px] border border-black/10 px-5 py-3 text-sm font-semibold">View my orders</Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!(await hasAuthenticatedCustomer())) {
    redirect(`/configurator/cart/${encodeURIComponent(cartId)}/shipping`);
  }

  return (
    <main className="techpack-cart-page techpack-studio-bg min-h-screen px-4 pb-8 sm:pb-10">
      <div className="mx-auto max-w-6xl">
        <ConfirmationStep cartId={cartId} paymentOutcome={paymentOutcome} checkoutAttemptId={checkoutAttemptId} />
      </div>
    </main>
  );
}
