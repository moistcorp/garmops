import AuthActionForm from "@/components/auth/AuthActionForm";
import AuthShell from "@/components/auth/AuthShell";
import CustomerAuthFlow from "@/components/auth/CustomerAuthFlow";
import CustomerAuthShell from "@/components/auth/CustomerAuthShell";
import { safeInternalPath } from "@/lib/auth/redirects";
import { isStaffSurface } from "@/lib/config/appSurface";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (isStaffSurface()) {
    return (
      <AuthShell
        eyebrow="Garmops Foundry"
        title="Staff sign in"
        description="Use your approved staff email and password. Customer accounts cannot enter Foundry."
      >
        <AuthActionForm variant="login" portal="staff" next={safeInternalPath(next, "/orders")} />
      </AuthShell>
    );
  }

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
