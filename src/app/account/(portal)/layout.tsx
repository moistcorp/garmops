import { requireOrganizationMember } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AccountPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOrganizationMember("/account");
  return <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">{children}</main>;
}
