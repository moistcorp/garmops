import GarmopsLogo from "@/components/common/GarmopsLogo";

export default function StaffLoginShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-(--color-cream) px-5 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-10 flex justify-center">
          <GarmopsLogo preload className="h-7 w-auto" />
        </div>

        <section className="w-full" aria-labelledby="staff-login-title">
          <h1 id="staff-login-title" className="sr-only">
            Staff sign in
          </h1>
          {children}
        </section>
      </div>
    </main>
  );
}
