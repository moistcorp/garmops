"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import CustomerAuthFlow from "./CustomerAuthFlow";

interface CustomerAuthDialogProps {
  open: boolean;
  onClose: () => void;
  next?: string;
  onAuthenticated: (destination: string) => void;
  title?: string;
  description?: string;
  contextSummary?: string;
}

export default function CustomerAuthDialog({
  open,
  onClose,
  next,
  onAuthenticated,
  title = "Sign in or create an account",
  description = "Use your email to view and track your Garmops orders.",
  contextSummary,
}: CustomerAuthDialogProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    wasOpenRef.current = open;
  }, [open]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-(--color-navy)/55 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
          <Dialog.Popup
            finalFocus={returnFocusRef}
            className="h-[100dvh] max-h-[100dvh] w-full overflow-y-auto overscroll-contain border-(--color-navy) bg-white outline-none transition-[opacity,transform] duration-200 data-[ending-style]:translate-y-4 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-4 data-[starting-style]:opacity-0 motion-reduce:transform-none motion-reduce:transition-none sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-[520px] sm:rounded-sm sm:border"
          >
            <header className="sticky top-0 z-10 border-b border-(--color-rule) bg-white px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:static sm:px-8 sm:pt-6">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-(--text-primary)/55">
                  Secure sign in
                </span>
                <div className="flex items-center gap-2">
                  <span className="techpack-stamp" data-tone="accent">No password</span>
                  <Dialog.Close
                    className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-transparent transition-[border-color,transform] duration-150 hover:border-(--color-rule) active:scale-[.97] motion-reduce:transform-none"
                    aria-label="Continue editing"
                    title="Continue editing"
                  >
                    <X size={18} />
                  </Dialog.Close>
                </div>
              </div>
              <Dialog.Title className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-relaxed text-black/58">
                {description}
              </Dialog.Description>
              {contextSummary ? (
                <p
                  aria-label="Design being secured"
                  className="mt-3 rounded-sm border border-(--color-accent)/18 bg-(--color-accent)/5 px-3 py-2 text-xs font-medium leading-relaxed text-(--text-primary)/68"
                >
                  {contextSummary}
                </p>
              ) : null}
            </header>
            <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-8 sm:pb-8 sm:pt-6">
              <CustomerAuthFlow next={next} onAuthenticated={onAuthenticated} />
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
