import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";
import GarmopsLogo from "@/components/common/GarmopsLogo";
import PortalNav, { type PortalNavItem } from "./PortalNav";

export default function PortalShell({
  kind,
  title,
  subtitle,
  identity,
  nav,
  children,
}: {
  kind: "Customer workspace" | "Staff operations";
  title: string;
  subtitle: string;
  identity: string;
  nav: PortalNavItem[];
  children: React.ReactNode;
}) {
  return (
    <main className="techpack-canvas techpack-paper-grid min-h-screen p-3 sm:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-[1500px] overflow-hidden rounded-[4px] border border-[var(--color-rule)] bg-white lg:grid-cols-[260px_1fr]">
        <aside className="techpack-dark flex flex-col p-5 text-white sm:p-7">
          <Link href="/" aria-label="Garmops home" className="inline-flex">
            <GarmopsLogo inverted className="h-4 w-auto" />
          </Link>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">{kind}</p>
          <PortalNav items={nav} />
          <div className="mt-8 border-t border-white/10 pt-5">
            <p className="truncate text-xs text-white/45">{identity}</p>
            <form action={logoutAction}>
              <button className="mt-3 text-xs font-medium text-white/70 hover:text-white" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </aside>
        <section className="min-w-0 p-5 sm:p-8 lg:p-10">
          <header className="mb-8 border-b border-[var(--color-rule)] pb-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-accent)]">{kind} / secure workspace</p>
              <span className="techpack-stamp" data-tone="success">Authenticated</span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-black/45">{subtitle}</p>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
