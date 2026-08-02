import type { ReactNode } from "react";

export default function TechpackPageHeader({
  eyebrow,
  reference,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  reference: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-[var(--color-rule)] pb-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.12em]">
            <span className="text-[var(--color-accent)]">{eyebrow}</span>
            <span aria-hidden="true" className="text-[var(--text-primary)]/25">/</span>
            <span className="text-[var(--text-primary)]/40">{reference}</span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-navy)]">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-primary)]/55">
            {description}
          </p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
