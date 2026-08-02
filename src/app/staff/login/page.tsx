import type { Metadata } from "next";
import AuthActionForm from "@/components/auth/AuthActionForm";
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
    <main className="techpack-canvas flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <section className="w-full max-w-md rounded-[6px] border border-[var(--color-rule)] bg-white p-6 sm:p-8">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--color-accent)]">
          Garmops operations
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">Staff sign in</h1>
        <p className="mt-2 text-sm leading-relaxed text-black/50">
          Use your staff email and password to access operations.
        </p>
        <div className="mt-7">
          <AuthActionForm variant="login" portal="staff" next={safeInternalPath(next, "/staff")} />
        </div>
      </section>
    </main>
  );
}
