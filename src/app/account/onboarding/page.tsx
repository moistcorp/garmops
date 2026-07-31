import AuthActionForm from "@/components/auth/AuthActionForm";
import AuthShell from "@/components/auth/AuthShell";
import { requireVerifiedUser } from "@/lib/auth/guards";

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
    const { redirect } = await import("next/navigation");
    redirect("/account");
  }

  const metadata = user.user_metadata ?? {};
  return (
    <AuthShell
      eyebrow="Verified account"
      title="Finish company setup"
      description="This creates the organization and makes you its owner in one atomic operation."
    >
      <AuthActionForm
        variant="onboarding"
        defaults={{
          firstName: String(metadata.first_name ?? ""),
          lastName: String(metadata.last_name ?? ""),
          companyName: String(metadata.company_name ?? ""),
          phone: String(metadata.phone ?? ""),
          department: String(metadata.department ?? ""),
          jobTitle: String(metadata.job_title ?? ""),
          website: String(metadata.website ?? ""),
          gstin: String(metadata.gstin ?? ""),
          industry: String(metadata.industry ?? ""),
        }}
      />
    </AuthShell>
  );
}
