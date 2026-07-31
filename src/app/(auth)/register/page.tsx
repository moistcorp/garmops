import Link from "next/link";
import AuthActionForm from "@/components/auth/AuthActionForm";
import AuthShell from "@/components/auth/AuthShell";

export default function RegisterPage() {
  return (
    <AuthShell
      eyebrow="Customer account"
      title="Create your company workspace"
      description="The first verified registrant becomes the organization owner. Use a work email you can verify."
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="text-[var(--color-accent)] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <AuthActionForm variant="register" />
    </AuthShell>
  );
}
