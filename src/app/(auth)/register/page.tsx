import Link from "next/link";
import AuthActionForm from "@/components/auth/AuthActionForm";
import CustomerAuthShell from "@/components/auth/CustomerAuthShell";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; phone?: string }>;
}) {
  const { email, phone } = await searchParams;
  const phoneDigits = phone?.replace(/\D/g, "") ?? "";
  const registrationPhone =
    phoneDigits.length === 12 && phoneDigits.startsWith("91")
      ? phoneDigits.slice(2)
      : phoneDigits;
  return (
    <CustomerAuthShell
      title="Create an account"
      description="Create your account to manage your orders and quotes."
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="text-[var(--color-accent)] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <AuthActionForm
        variant="register"
        defaults={{ email: email ?? "", phone: registrationPhone }}
      />
      <section className="mt-8 border-t border-[var(--color-rule)] pt-6">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">Why register as a business?</p>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-black/60">
          <li>Claim GST Input Tax Credit</li>
          <li>Save More With Business Deals</li>
          <li>Dedicated Business Account Manager for you</li>
        </ul>
      </section>
    </CustomerAuthShell>
  );
}
