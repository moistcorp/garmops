import type { Metadata } from "next";
import Link from "next/link";
import AuthActionForm from "@/components/auth/AuthActionForm";
import AuthShell from "@/components/auth/AuthShell";
import { safeInternalPath } from "@/lib/auth/redirects";

export const metadata: Metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false, nocache: true },
};

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthShell
      eyebrow="Garmops operations"
      title="Staff sign in"
      description="Invite-only access to order management, finance, production, and fulfilment. Authenticator MFA is required after password sign-in."
      footer={
        <>
          Customer? <Link href="/login" className="text-[var(--color-accent)] hover:underline">Sign in to your account</Link>
        </>
      }
    >
      <AuthActionForm variant="login" portal="staff" next={safeInternalPath(next, "/staff")} />
    </AuthShell>
  );
}
