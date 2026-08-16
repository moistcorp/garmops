import type { ReactNode } from "react";

export default function TechpackSectionHeading({
  index,
  title,
  description,
  icon,
}: {
  index: string;
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start gap-3 border-b border-(--color-rule) pb-4">
      {icon ? (
        <span className="rounded-sm border border-(--color-accent)/25 bg-(--color-accent)/5 p-2 text-(--color-accent)">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-(--color-accent)">
          {index} / Specification section
        </p>
        <h2 className="mt-1 text-sm font-semibold uppercase tracking-[0.06em] text-(--color-navy)">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-(--text-muted)">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
