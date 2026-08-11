import Link from "next/link";
import { MonitorUp } from "lucide-react";

export default function ConfiguratorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <main className="techpack-canvas flex min-h-dvh items-center justify-center px-6 py-12 lg:hidden">
        <section className="w-full max-w-md border border-(--color-rule) bg-(--color-cream) p-7 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-sm border border-(--color-accent)/30 bg-(--color-cream-soft) text-(--color-accent-dark)">
            <MonitorUp size={25} aria-hidden="true" />
          </span>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-(--text-primary)/50">
            Desktop required
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-(--text-primary)">
            Continue on a desktop
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-(--text-primary)/60">
            The Garmops configurator is currently available on desktop only.
            Open this page on a screen at least 1024 px wide to customise your
            products and continue to full-payment checkout.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-sm bg-(--color-accent) px-6 py-3 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-white hover:bg-(--color-accent-dark)"
          >
            Back to home
          </Link>
        </section>
      </main>
      <div className="hidden lg:contents">{children}</div>
    </>
  );
}
