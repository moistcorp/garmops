import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import { isStaffSurface } from "@/lib/config/appSurface";

const messages: Record<string, string> = {
  AUTH_CALLBACK_FAILED: "That sign-in link is invalid or has expired.",
  ACCOUNT_ACCESS_FAILED: "We could not verify your account access.",
  ACCOUNT_ACCESS_DENIED: "This account is inactive.",
  CUSTOMER_ACCESS_DENIED: "That email is not available for customer access.",
  STAFF_ACCESS_DENIED: "Unable to sign in with those staff credentials.",
  STAFF_PERMISSION_DENIED: "Your staff role does not permit that operation.",
  MFA_CHECK_FAILED: "We could not verify the authenticator session.",
};

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const code = (await searchParams).code ?? "";
  const staff = isStaffSurface();
  return (
    <AuthShell
      eyebrow="Access interrupted"
      title="We could not continue"
      description={messages[code] ?? "The requested authentication step could not be completed."}
      footer={<Link href="/login" className="text-(--color-accent) hover:underline">Return to {staff ? "Foundry" : "customer"} sign in</Link>}
    >
      <div className="rounded-sm border border-black/10 bg-white p-5 text-sm text-black/55">
        Contact Garmops support if this continues. Never share your password or authenticator code.
      </div>
    </AuthShell>
  );
}
