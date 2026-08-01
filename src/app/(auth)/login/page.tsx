import CustomerAuthFlow from "@/components/auth/CustomerAuthFlow";
import CustomerAuthShell from "@/components/auth/CustomerAuthShell";
import { safeInternalPath } from "@/lib/auth/redirects";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeInternalPath(next, "/account/orders");
  return (
    <CustomerAuthShell
      title="Login / Sign up"
      description="Use your email to view and track your Garmops orders."
    >
      <CustomerAuthFlow next={destination} />
    </CustomerAuthShell>
  );
}
