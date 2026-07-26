"use client";

import { CheckCircle2, CircleAlert, LoaderCircle, X } from "lucide-react";

export type ActionFeedbackTone = "loading" | "success" | "error" | "info";

interface ActionFeedbackProps {
  tone: ActionFeedbackTone;
  title: string;
  detail?: string;
  onDismiss?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

export function ActionFeedback({
  tone,
  title,
  detail,
  onDismiss,
  actionLabel,
  onAction,
}: ActionFeedbackProps) {
  const Icon = tone === "loading" ? LoaderCircle : tone === "success" ? CheckCircle2 : CircleAlert;
  const toneClass =
    tone === "error"
      ? "border-[#F0CACA] bg-[#FFF5F5] text-[#8A2E2E]"
      : tone === "success"
        ? "border-[#CDE8D2] bg-[#F2FBF3] text-[#1B6A2E]"
        : tone === "loading"
          ? "border-[var(--color-teal)]/25 bg-[var(--color-teal)]/5 text-[var(--color-teal-dark)]"
          : "border-[#E5E5E5] bg-[#F7F7F7] text-[#111111]/70";

  return (
    <div role={tone === "error" ? "alert" : "status"} aria-live="polite" className={`flex items-start gap-3 rounded-xl border p-3 text-xs ${toneClass}`}>
      <Icon size={17} className={`mt-0.5 shrink-0 ${tone === "loading" ? "animate-spin" : ""}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {detail && <p className="mt-1 leading-relaxed opacity-80">{detail}</p>}
        {actionLabel && onAction && (
          <button type="button" onClick={onAction} className="mt-2 rounded-full border border-current px-3 py-1 font-semibold">
            {actionLabel}
          </button>
        )}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss message" className="rounded-full p-1 hover:bg-black/5">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
