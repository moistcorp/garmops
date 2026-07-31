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
    <div className="techpack-canvas min-h-[calc(100vh-4.5rem)] px-4 py-10 sm:px-6 sm:py-16">
      <section className="mx-auto w-full max-w-[480px] border border-[var(--color-rule)] bg-white px-5 py-7 sm:px-10 sm:py-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-black/55">{description}</p>
        <div className="mt-8">{children}</div>
        {footer ? <div className="mt-6 border-t border-[var(--color-rule)] pt-5 text-sm text-black/55">{footer}</div> : null}
      </section>
    </div>
  );
}
