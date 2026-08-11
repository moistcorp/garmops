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
  const iconClass =
    tone === "error"
      ? "text-[#A62D2D]"
      : tone === "success"
        ? "text-[#276E48]"
        : "text-(--color-accent)";

  return (
    <div role={tone === "error" ? "alert" : "status"} aria-live="polite" data-tone={tone} className="techpack-notice flex items-start gap-3 p-3 text-xs">
      <Icon size={17} className={`mt-0.5 shrink-0 ${iconClass} ${tone === "loading" ? "animate-spin" : ""}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="mb-1 font-mono text-xs font-semibold uppercase tracking-[0.12em] opacity-45">
          {tone === "error" ? "Action required" : tone === "success" ? "Confirmed" : tone === "loading" ? "Processing" : "Notice"}
        </p>
        <p className="font-semibold">{title}</p>
        {detail && <p className="mt-1 leading-relaxed opacity-80">{detail}</p>}
        {actionLabel && onAction && (
          <button type="button" onClick={onAction} className="mt-2 rounded-sm border border-current px-3 py-1 font-semibold">
            {actionLabel}
          </button>
        )}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss message" className="rounded-sm p-1 hover:bg-black/5">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
