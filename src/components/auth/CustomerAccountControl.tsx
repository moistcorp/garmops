"use client";

import { Menu } from "@base-ui/react/menu";
import Link from "next/link";
import { ChevronDown, UserRound } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import type { CustomerSession } from "./useCustomerSession";

export default function CustomerAccountControl({ session, onOpenAuth, mobile = false, onNavigate, desktopClassName }: { session: CustomerSession; onOpenAuth: () => void; mobile?: boolean; onNavigate?: () => void; desktopClassName?: string }) {
  const savedDesignsEnabled = process.env.NEXT_PUBLIC_CLOUD_DESIGNS_ENABLED === "true";
  if (session.loading) {
    if (mobile) return <span aria-label="Loading account" className="block h-11 rounded-sm bg-black/5" />;

    return (
      <span
        aria-label="Loading account"
        aria-busy="true"
        className={`${desktopClassName ?? "inline-flex min-h-11 items-center gap-1.5 font-mono text-[13px] leading-none uppercase tracking-[0.04em] text-[#444444]"} pointer-events-none opacity-60`}
      >
        <UserRound size={16} aria-hidden="true" />
        Account
      </span>
    );
  }
  if (!session.email) return <button type="button" onClick={onOpenAuth} className={mobile ? "mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-sm border border-(--color-rule) px-5 py-3 text-center font-mono text-sm uppercase tracking-[0.06em] text-(--text-primary)/70" : desktopClassName ?? "inline-flex min-h-11 items-center gap-1.5 font-mono text-[13px] leading-none uppercase tracking-[0.04em] text-[#444444] transition-colors hover:text-(--color-accent)"}><UserRound size={mobile ? 15 : 16} aria-hidden="true" />Login / Sign up</button>;
  if (mobile) return <div className="mt-2 border-t border-(--color-rule) pt-3"><p className="px-1 text-xs text-black/45">Signed in as {session.email}</p><Link href="/account/orders" onClick={onNavigate} className="mt-2 block min-h-11 rounded-sm border border-(--color-rule) px-5 py-3 text-center font-mono text-sm uppercase tracking-[0.06em] text-(--text-primary)/70">My orders</Link>{savedDesignsEnabled ? <Link href="/account/designs" onClick={onNavigate} className="mt-2 block min-h-11 rounded-sm border border-(--color-rule) px-5 py-3 text-center font-mono text-sm uppercase tracking-[0.06em] text-(--text-primary)/70">Saved designs</Link> : null}<Link href="/account/billing" onClick={onNavigate} className="mt-2 block min-h-11 rounded-sm border border-(--color-rule) px-5 py-3 text-center font-mono text-sm uppercase tracking-[0.06em] text-(--text-primary)/70">Billing & addresses</Link><form action={logoutAction} onSubmit={onNavigate}><button className="mt-2 block min-h-11 w-full rounded-sm border border-(--color-rule) px-5 py-3 text-center font-mono text-sm uppercase tracking-[0.06em] text-(--text-primary)/70">Log out</button></form></div>;
  const itemClassName = "flex min-h-11 items-center rounded-sm px-3 text-sm outline-none hover:bg-black/5 data-[highlighted]:bg-black/5";

  return (
    <Menu.Root>
      <Menu.Trigger className={desktopClassName ?? "inline-flex min-h-11 items-center gap-1.5 font-mono text-[13px] leading-none uppercase tracking-[0.04em] text-[#444444] transition-colors hover:text-(--color-accent)"}>
        <UserRound size={16} aria-hidden="true" />
        <span className="max-w-24 truncate">{session.label ?? "Account"}</span>
        <ChevronDown size={14} aria-hidden="true" className="transition-transform data-[popup-open]:rotate-180" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-[60] outline-none">
          <Menu.Popup className="w-60 rounded-sm border border-(--color-rule) bg-white p-2 shadow-[0_16px_40px_rgba(22,33,43,0.14)] outline-none">
            <p className="truncate px-3 py-2 text-xs text-black/45">{session.email}</p>
            <Menu.LinkItem render={<Link href="/account/orders" />} closeOnClick className={itemClassName}>My orders</Menu.LinkItem>
            {savedDesignsEnabled ? <Menu.LinkItem render={<Link href="/account/designs" />} closeOnClick className={itemClassName}>Saved designs</Menu.LinkItem> : null}
            <Menu.LinkItem render={<Link href="/account/billing" />} closeOnClick className={itemClassName}>Billing & addresses</Menu.LinkItem>
            <form action={logoutAction}>
              <Menu.Item render={<button type="submit" />} nativeButton className={`${itemClassName} w-full text-left`}>Log out</Menu.Item>
            </form>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
