import Link from "next/link";

export default function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="app-liquid-bg min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl items-center">
        <div className="grid w-full overflow-hidden rounded-[32px] border border-black/10 bg-white/70 shadow-2xl shadow-black/5 backdrop-blur-xl lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="liquid-glass-dark hidden min-h-[640px] flex-col justify-between p-10 text-white lg:flex">
            <Link href="/" className="text-xl font-bold tracking-tight">
              Garmops
            </Link>
            <div>
              <p className="mb-4 text-xs uppercase tracking-[0.24em] text-white/45">
                Production, without guesswork
              </p>
              <p className="max-w-sm text-3xl font-semibold leading-tight">
                One secure workspace from approved design to dispatch.
              </p>
            </div>
            <p className="text-xs leading-relaxed text-white/40">
              Customer workspaces are organization-isolated. Staff access
              requires invite-only authenticator MFA.
            </p>
          </aside>
          <section className="flex min-h-[640px] items-center p-5 sm:p-10 lg:p-14">
            <div className="mx-auto w-full max-w-xl">
              <Link href="/" className="mb-10 inline-block text-lg font-bold lg:hidden">
                Garmops
              </Link>
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-teal)]">
                {eyebrow}
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
              <p className="mt-3 text-sm leading-relaxed text-black/50">{description}</p>
              <div className="mt-8">{children}</div>
              {footer ? <div className="mt-6 text-sm text-black/50">{footer}</div> : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
