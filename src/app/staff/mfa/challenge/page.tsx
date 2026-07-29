import AuthShell from "@/components/auth/AuthShell";
import MfaFlow from "@/components/staff/MfaFlow";
import { requireStaffRecord } from "@/lib/auth/guards";

export default async function StaffMfaChallengePage() {
  await requireStaffRecord({ allowInvited: true });
  return (
    <AuthShell
      eyebrow="Staff security"
      title="Confirm your authenticator"
      description="Enter the current six-digit code. Staff permissions are denied until this session reaches AAL2."
    >
      <MfaFlow mode="challenge" />
    </AuthShell>
  );
}
