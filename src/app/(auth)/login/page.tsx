import Link from "next/link";
import AuthActionForm from "@/components/auth/AuthActionForm";
import AuthShell from "@/components/auth/AuthShell";
import { safeInternalPath } from "@/lib/auth/redirects";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthShell
      eyebrow="Secure workspace"
      title="Welcome back"
      description="Sign in with your work email. Staff accounts continue through authenticator MFA."
      footer={
        <>
          New customer?{" "}
          <Link href="/register" className="text-[var(--color-teal)] hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <AuthActionForm variant="login" next={safeInternalPath(next)} />
    </AuthShell>
  );
}
