import type { Metadata } from "next";
import StaffMfaSetup from "@/components/staff/StaffMfaSetup";
import { requireStaffRecord } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Foundry security",
  robots: { index: false, follow: false, nocache: true },
};
export const dynamic = "force-dynamic";

export default async function StaffSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await requireStaffRecord({ allowMfaPending: true, next: "/settings/security" });
  await searchParams;
  return (
    <main className="techpack-canvas techpack-paper-grid flex min-h-screen items-center px-4 py-10 sm:px-6">
      <StaffMfaSetup />
    </main>
  );
}
