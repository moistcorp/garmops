import CustomerAuthFlow from "@/components/auth/CustomerAuthFlow";
import CustomerAuthShell from "@/components/auth/CustomerAuthShell";
import { requireVerifiedUser } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function AccountOnboardingPage() { const { user } = await requireVerifiedUser("/account/onboarding"); if (user.first_name) redirect("/account/orders"); return <CustomerAuthShell title="Finish setting up your account" description="Your Medusa customer account is ready for checkout."><CustomerAuthFlow next="/account/orders" initialEmail={user.email} /></CustomerAuthShell>; }
