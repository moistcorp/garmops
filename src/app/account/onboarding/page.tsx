import CustomerAuthFlow from "@/components/auth/CustomerAuthFlow";
import CustomerAuthShell from "@/components/auth/CustomerAuthShell";
import { requireVerifiedUser } from "@/lib/auth/guards";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AccountOnboardingPage() {
  const { user, supabase } = await requireVerifiedUser("/account/onboarding");
  const { data: existing } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (existing) {
    redirect("/account/orders");
  }

  return (
    <CustomerAuthShell
      title="Finish setting up your account"
      description="Add a few details to view and track your Garmops orders."
    >
      <CustomerAuthFlow next="/account/orders" />
    </CustomerAuthShell>
  );
}
