import Link from "next/link";
import AuthActionForm from "@/components/auth/AuthActionForm";
import AuthShell from "@/components/auth/AuthShell";

export default function VerifyEmailPage() {
  return (
    <AuthShell
      eyebrow="Email verification"
      title="Verify your work email"
      description="Open the verification link we sent. If it expired, request another below."
      footer={<Link href="/login" className="text-[var(--color-accent)] hover:underline">Return to sign in</Link>}
    >
      <AuthActionForm variant="verify" />
    </AuthShell>
  );
}
