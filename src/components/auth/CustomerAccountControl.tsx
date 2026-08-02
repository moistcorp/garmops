"use client";

import Link from "next/link";
import { ChevronDown, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import type { CustomerSession } from "./useCustomerSession";

export default function CustomerAccountControl({ session, onOpenAuth, mobile = false, onNavigate }: { session: CustomerSession; onOpenAuth: () => void; mobile?: boolean; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const savedDesignsEnabled = process.env.NEXT_PUBLIC_CLOUD_DESIGNS_ENABLED === "true";
  useEffect(() => {
    if (!open || mobile) return;
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) setOpen(false); };
    const keys = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); requestAnimationFrame(() => triggerRef.current?.focus()); } };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", keys);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", keys); };
  }, [mobile, open]);
  if (session.loading) return <span aria-label="Loading account" className={mobile ? "block h-11 rounded-[4px] bg-black/5" : "block h-7 w-28 rounded-[4px] bg-black/5"} />;
  if (!session.email) return <button ref={triggerRef} type="button" onClick={onOpenAuth} className={mobile ? "mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[4px] border border-[var(--color-rule)] px-5 py-3 text-center font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-primary)]/70" : "inline-flex min-h-11 items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[#444444] transition-colors hover:text-[var(--color-accent)]"}><UserRound size={15} aria-hidden="true" />Login / Sign up</button>;
  if (mobile) return <div className="mt-2 border-t border-[var(--color-rule)] pt-3"><p className="px-1 text-xs text-black/45">Signed in as {session.email}</p><Link href="/account/orders" onClick={onNavigate} className="mt-2 block min-h-11 rounded-[4px] border border-[var(--color-rule)] px-5 py-3 text-center font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-primary)]/70">My orders</Link>{savedDesignsEnabled ? <Link href="/account/designs" onClick={onNavigate} className="mt-2 block min-h-11 rounded-[4px] border border-[var(--color-rule)] px-5 py-3 text-center font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-primary)]/70">Saved designs</Link> : null}<Link href="/account/company" onClick={onNavigate} className="mt-2 block min-h-11 rounded-[4px] border border-[var(--color-rule)] px-5 py-3 text-center font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-primary)]/70">Company details</Link><form action={logoutAction} onSubmit={onNavigate}><button className="mt-2 block min-h-11 w-full rounded-[4px] border border-[var(--color-rule)] px-5 py-3 text-center font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-primary)]/70">Log out</button></form></div>;
  return <div className="relative"><button ref={triggerRef} type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="customer-account-menu" className="inline-flex min-h-11 items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[#444444] hover:text-[var(--color-accent)]"><UserRound size={15} aria-hidden="true" /><span className="max-w-24 truncate">{session.label ?? "Account"}</span><ChevronDown size={14} aria-hidden="true" /></button>{open ? <div ref={menuRef} id="customer-account-menu" className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-60 rounded-[4px] border border-[var(--color-rule)] bg-white p-2"><p className="truncate px-3 py-2 text-xs text-black/45">{session.email}</p><Link href="/account/orders" onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-[4px] px-3 text-sm hover:bg-black/5">My orders</Link>{savedDesignsEnabled ? <Link href="/account/designs" onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-[4px] px-3 text-sm hover:bg-black/5">Saved designs</Link> : null}<Link href="/account/company" onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-[4px] px-3 text-sm hover:bg-black/5">Company details</Link><form action={logoutAction}><button className="flex min-h-11 w-full items-center rounded-[4px] px-3 text-left text-sm hover:bg-black/5">Log out</button></form></div> : null}</div>;
}
