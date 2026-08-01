import { redirect } from "next/navigation";
import { safeInternalPath } from "@/lib/auth/redirects";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  redirect(`/login?next=${encodeURIComponent(safeInternalPath(next, "/account/orders"))}`);
}
