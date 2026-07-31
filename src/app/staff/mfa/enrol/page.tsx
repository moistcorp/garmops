import AuthShell from "@/components/auth/AuthShell";
import MfaFlow from "@/components/staff/MfaFlow";
import { requireStaffRecord } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function StaffMfaEnrolPage() {
  await requireStaffRecord({ allowInvited: true });
  return (
    <AuthShell
      eyebrow="Staff security"
      title="Enroll authenticator MFA"
      description="Staff access stays inactive until a time-based authenticator code reaches assurance level AAL2."
    >
      <MfaFlow mode="enrol" />
    </AuthShell>
  );
}
