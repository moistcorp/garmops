import AuthActionForm from "@/components/auth/AuthActionForm";
import AuthShell from "@/components/auth/AuthShell";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Choose a new password"
      description="Use at least eight characters. Staff invitations continue to authenticator MFA after this step."
    >
      <AuthActionForm variant="reset" />
    </AuthShell>
  );
}
