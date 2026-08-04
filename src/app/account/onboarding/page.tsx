import CustomerAuthFlow from "@/components/auth/CustomerAuthFlow";
import CustomerAuthShell from "@/components/auth/CustomerAuthShell";
import { requireVerifiedUser } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function AccountOnboardingPage() { const { user, supabase } = await requireVerifiedUser("/account/onboarding"); const { data: profile } = await supabase.from("profiles").select("onboarding_completed_at").eq("id", user.id).maybeSingle(); if (profile?.onboarding_completed_at) redirect("/account/orders"); return <CustomerAuthShell title="Finish setting up your account" description="Add your name to activate your private Garmops customer account."><CustomerAuthFlow next="/account/orders" /></CustomerAuthShell>; }
