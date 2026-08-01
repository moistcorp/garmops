import Link from "next/link";
import CustomerLoginForm from "@/components/auth/CustomerLoginForm";
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
      title="Login or sign up"
      description="Use your email or mobile number to access your orders and quotes."
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
      <CustomerLoginForm next={safeInternalPath(next)} />
    </CustomerAuthShell>
  );
}
