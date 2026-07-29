import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";

type NavItem = { href: string; label: string };

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
  nav: NavItem[];
  children: React.ReactNode;
}) {
  return (
    <main className="app-liquid-bg min-h-screen p-3 sm:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-[1500px] overflow-hidden rounded-[28px] border border-black/10 bg-white/65 shadow-2xl shadow-black/5 backdrop-blur-xl lg:grid-cols-[260px_1fr]">
        <aside className="liquid-glass-dark flex flex-col p-5 text-white sm:p-7">
          <Link href="/" className="text-xl font-bold tracking-tight">Garmops</Link>
          <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/40">{kind}</p>
          <nav className="mt-10 flex flex-1 gap-2 overflow-x-auto lg:flex-col">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-xl px-3 py-2.5 text-sm text-white/65 transition-colors hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
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
          <header className="mb-8 border-b border-black/8 pb-7">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-teal)]">{kind}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-black/45">{subtitle}</p>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
