import Link from "next/link";
import AuthActionForm from "@/components/auth/AuthActionForm";
import AuthShell from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password"
      description="Enter your work email. The response stays intentionally generic to protect account privacy."
      footer={<Link href="/login" className="text-(--color-accent) hover:underline">Return to sign in</Link>}
    >
      <AuthActionForm variant="forgot" />
    </AuthShell>
  );
}
