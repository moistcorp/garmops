"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import CustomerAuthFlow from "./CustomerAuthFlow";

export default function CustomerAuthDialog({ open, onClose, next, onAuthenticated, title = "Sign in or create an account", description = "Use your email to view and track your Garmops orders." }: { open: boolean; onClose: () => void; next?: string; onAuthenticated: (destination: string) => void; title?: string; description?: string }) {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    wasOpenRef.current = open;
  }, [open]);

  return <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-[70] bg-(--color-navy)/55 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
      <Dialog.Viewport className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
        <Dialog.Popup finalFocus={returnFocusRef} className="max-h-[calc(100dvh-2rem)] w-full max-w-[520px] overflow-y-auto rounded-sm border border-(--color-navy) bg-white p-6 outline-none transition-[opacity,transform] duration-200 data-[ending-style]:translate-y-4 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-4 data-[starting-style]:opacity-0 sm:p-8">
      <div className="mb-5 flex items-center justify-between border-b border-(--color-rule) pb-3 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-(--text-muted)"><span>Access / Customer</span><span className="techpack-stamp" data-tone="accent">Email OTP</span></div>
      <div className="flex items-start justify-between gap-4"><div><Dialog.Title className="text-3xl font-semibold tracking-tight">{title}</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-relaxed text-black/55">{description}</Dialog.Description></div><Dialog.Close className="flex size-11 shrink-0 items-center justify-center rounded-sm border border-transparent hover:border-(--color-rule)" aria-label="Close login dialog"><X size={18} /></Dialog.Close></div>
      <div className="mt-7"><CustomerAuthFlow next={next} onAuthenticated={onAuthenticated} /></div>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>;
}
