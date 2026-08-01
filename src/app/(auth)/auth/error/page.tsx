import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";

const messages: Record<string, string> = {
  AUTH_CALLBACK_FAILED: "That sign-in link is invalid or has expired.",
  ACCOUNT_ACCESS_FAILED: "We could not verify your company access.",
  ACCOUNT_ACCESS_DENIED: "Your account does not have access to that company.",
  STAFF_ACCESS_DENIED: "This account does not have active staff access.",
  STAFF_LOGIN_REQUIRED: "Use the dedicated staff sign-in to access operations.",
  STAFF_PERMISSION_DENIED: "Your staff role does not permit that operation.",
  MFA_CHECK_FAILED: "We could not verify the authenticator session.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const code = (await searchParams).code ?? "";
  return (
    <AuthShell
      eyebrow="Access interrupted"
      title="We could not continue"
      description={messages[code] ?? "The requested authentication step could not be completed."}
      footer={
        <>
          <Link href="/login" className="text-[var(--color-accent)] hover:underline">Customer sign in</Link>
          <span className="mx-2">·</span>
          <Link href="/staff/login" className="text-[var(--color-accent)] hover:underline">Staff sign in</Link>
        </>
      }
    >
      <div className="rounded-[4px] border border-black/10 bg-white p-5 text-sm text-black/55">
        If this keeps happening, contact Garmops operations without sharing your password or authenticator code.
      </div>
    </AuthShell>
  );
}
