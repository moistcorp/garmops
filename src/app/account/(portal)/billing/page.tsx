import TechpackPageHeader from "@/components/portal/TechpackPageHeader";
import { requireCustomer } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function BillingDetailsPage() {
  const { user } = await requireCustomer("/account/billing");
  return <div className="space-y-7"><TechpackPageHeader eyebrow="Customer account" reference="Medusa checkout profile" title="Billing & addresses" description="Your contact, billing, GST and delivery details are validated and stored by Medusa during checkout."/><section className="techpack-surface rounded border p-6"><p className="text-sm text-black/60">Signed-in checkout email</p><p className="mt-2 font-semibold">{user.email}</p><p className="mt-5 text-sm text-black/50">Enter the latest shipping and billing details on each checkout. The backend remains the authoritative record for tax and delivery information.</p></section></div>;
}
