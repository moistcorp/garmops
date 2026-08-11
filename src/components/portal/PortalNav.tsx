"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type PortalNavItem = Readonly<{ href: string; label: string }>;

export default function PortalNav({ items }: { items: PortalNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Workspace" className="mt-10 flex flex-1 gap-2 overflow-x-auto lg:flex-col">
      {items.map((item, index) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-sm border px-3 py-2.5 text-sm transition-colors ${
              active
                ? "border-white/25 bg-white/12 text-white"
                : "border-transparent text-white/65 hover:border-white/15 hover:bg-white/8 hover:text-white"
            }`}
          >
            <span className="mr-2 font-mono text-[10px] text-white/35">
              {String(index + 1).padStart(2, "0")}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
