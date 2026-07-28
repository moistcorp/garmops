import Link from "next/link";
import { MonitorUp } from "lucide-react";

export default function ConfiguratorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <main className="app-liquid-bg flex min-h-dvh items-center justify-center px-6 py-12 lg:hidden">
        <section className="liquid-glass-surface w-full max-w-md rounded-[28px] border p-7 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-teal)]/10 text-[var(--color-teal-dark)]">
            <MonitorUp size={25} aria-hidden="true" />
          </span>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-[#111111]/50">
            Desktop required
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#111111]">
            Continue on a desktop
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#111111]/60">
            The Garmops configurator is currently available on desktop only.
            Open this page on a screen at least 1024 px wide to customise your
            products and reserve a production review.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-full bg-[var(--color-teal)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)]"
          >
            Back to home
          </Link>
        </section>
      </main>
      <div className="hidden lg:contents">{children}</div>
    </>
  );
}
