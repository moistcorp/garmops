import type { Metadata } from "next";
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
      description="Use your staff email and password to access the operations workspace."
    >
      <AuthActionForm variant="login" portal="staff" next={safeInternalPath(next, "/staff")} />
    </AuthShell>
  );
}
