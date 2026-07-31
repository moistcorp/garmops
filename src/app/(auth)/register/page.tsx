import Link from "next/link";
import AuthActionForm from "@/components/auth/AuthActionForm";
import CustomerAuthShell from "@/components/auth/CustomerAuthShell";

export default function RegisterPage() {
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
      <AuthActionForm variant="register" />
    </CustomerAuthShell>
  );
}
