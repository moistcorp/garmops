import Link from "next/link";
import AuthActionForm from "@/components/auth/AuthActionForm";
import CustomerAuthShell from "@/components/auth/CustomerAuthShell";
import { safeInternalPath } from "@/lib/auth/redirects";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <CustomerAuthShell
      title="Welcome back"
      description="Sign in to manage your orders and quotes."
      footer={
        <>
          New customer?{" "}
          <Link
            href="/register"
            prefetch={false}
            className="text-[var(--color-accent)] hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <AuthActionForm variant="login" next={safeInternalPath(next)} />
    </CustomerAuthShell>
  );
}
