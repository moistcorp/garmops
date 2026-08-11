import Link from "next/link";
import GarmopsLogo from "@/components/common/GarmopsLogo";

export default function CustomerAuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="techpack-canvas techpack-paper-grid min-h-screen px-4 py-10 sm:px-6 sm:py-16">
      <section className="mx-auto w-full max-w-[520px] border border-(--color-rule) bg-white">
        <div className="flex items-center justify-between border-b border-(--color-rule) px-5 py-3 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-(--text-primary)/40 sm:px-10">
          <Link href="/" aria-label="Garmops home" className="inline-flex">
            <GarmopsLogo className="h-3 w-auto" />
          </Link>
          <span>Access / Customer</span>
        </div>
        <div className="px-5 py-7 sm:px-10 sm:py-10">
          <span className="techpack-stamp" data-tone="accent">
            Secure email access
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-black/55">
            {description}
          </p>
          <div className="mt-8">{children}</div>
          {footer ? (
            <div className="mt-6 border-t border-(--color-rule) pt-5 text-sm text-black/55">
              {footer}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
