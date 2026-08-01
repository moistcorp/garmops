"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import CustomerAuthFlow from "./CustomerAuthFlow";

export default function CustomerAuthDialog({ open, onClose, next, onAuthenticated }: { open: boolean; onClose: () => void; next?: string; onAuthenticated: (destination: string) => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("input, button, a[href]")?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled])") ?? []);
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); returnFocusRef.current?.focus(); };
  }, [open]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#16212B]/55 p-4 sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="customer-auth-title" aria-describedby="customer-auth-description" className="max-h-[calc(100dvh-2rem)] w-full max-w-[480px] overflow-y-auto rounded-[4px] border border-[var(--color-navy)] bg-white p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4"><div><h2 id="customer-auth-title" className="text-3xl font-semibold tracking-tight">Login / Sign up</h2><p id="customer-auth-description" className="mt-2 text-sm leading-relaxed text-black/55">Use your email to view and track your Garmops orders.</p></div><button type="button" onClick={onClose} className="flex size-11 shrink-0 items-center justify-center rounded-[4px] border border-transparent hover:border-[var(--color-rule)]" aria-label="Close login dialog"><X size={18} /></button></div>
      <div className="mt-7"><CustomerAuthFlow next={next} onAuthenticated={onAuthenticated} /></div>
    </div>
  </div>;
}
