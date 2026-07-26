"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Edit2, Plus, Trash2, X } from "lucide-react";

export interface AccordionItemProps {
  title: string;
  summary: string | null;
  confirmed: boolean;
  skipped?: boolean;
  optional?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  hideDelete?: boolean;
  children: ReactNode;
}

export function AccordionItem({
  title,
  summary,
  confirmed,
  skipped = false,
  optional = false,
  expanded,
  onToggle,
  onDelete,
  hideDelete = false,
  children,
}: AccordionItemProps) {
  const hasSelection = Boolean(summary);
  const complete = confirmed || skipped;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmingDelete) cancelButtonRef.current?.focus();
  }, [confirmingDelete]);

  function handleToggle() {
    setConfirmingDelete(false);
    onToggle();
  }

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-[28px] border bg-white shadow-[0_4px_16px_rgba(22,33,43,0.04)] ${
        expanded ? "flex-1 border-[var(--color-teal)]" : "shrink-0 border-[#ECE7DF]"
      }`}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
        className="flex min-h-[72px] w-full items-start justify-between gap-4 px-4 py-3 text-left hover:bg-[#FCFCFA]"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold leading-tight text-[#111111]">{title}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                optional
                  ? "bg-[#F2F0EA] text-[#111111]/55"
                  : "bg-[var(--color-teal)]/10 text-[var(--color-teal-dark)]"
              }`}
            >
              {optional ? "Optional" : "Required"}
            </span>
          </span>
          <span className="mt-1 line-clamp-2 break-words text-xs font-medium leading-snug text-[#111111]/55">
            {summary ?? (optional ? "Not added - you can skip this step" : "Choose an option to continue")}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          {complete ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-teal)]/10 text-[var(--color-teal)]">
              <Check size={17} strokeWidth={2.4} />
            </span>
          ) : hasSelection ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-cream-soft)] text-[var(--color-teal)]">
              <Edit2 size={16} strokeWidth={2.2} />
            </span>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-cream-soft)]">
              <Plus size={17} strokeWidth={2.2} />
            </span>
          )}
          <ChevronDown
            size={16}
            strokeWidth={2.1}
            className={`text-[#111111]/45 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
          {!hideDelete && hasSelection && !expanded && (
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                setConfirmingDelete(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.stopPropagation();
                  setConfirmingDelete(true);
                }
              }}
              aria-label={`Remove ${title} selection`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-cream-soft)] text-[#C62828]"
            >
              <Trash2 size={15} strokeWidth={2.2} />
            </span>
          )}
        </span>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
          confirmingDelete && !hideDelete ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-t border-[#F3D9D9] bg-[#FDF3F3] px-4 py-2.5">
            <p className="text-xs font-medium text-[#8A2E2E]">
              Remove this {title.toLowerCase()} selection?
            </p>
            <span className="flex shrink-0 items-center gap-1.5">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setConfirmingDelete(false);
                }}
                className="flex h-7 items-center gap-1 rounded-full border border-[#E5E5E5] bg-white px-2 text-xs font-semibold text-[#111111]/70"
              >
                <X size={13} strokeWidth={2.4} />
                Cancel
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setConfirmingDelete(false);
                  onDelete();
                }}
                className="flex h-7 items-center gap-1 rounded-full bg-[#C62828] px-2 text-xs font-semibold text-white"
              >
                <Trash2 size={13} strokeWidth={2.4} />
                Remove
              </button>
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#ECE7DF] bg-white px-4 py-4">
          {children}
        </div>
      )}
    </div>
  );
}
