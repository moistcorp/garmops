"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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
  const panelId = useId();

  useEffect(() => {
    if (confirmingDelete) cancelButtonRef.current?.focus();
  }, [confirmingDelete]);

  function handleToggle() {
    setConfirmingDelete(false);
    onToggle();
  }

  return (
    <section
      className={`techpack-subtle flex min-h-0 flex-col overflow-hidden rounded-[4px] border ${
        expanded ? "flex-1 border-[var(--color-accent)]" : "shrink-0 border-[#ECE7DF]"
      }`}
    >
      <div className="flex min-h-[72px] items-stretch">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-start justify-between gap-4 px-4 py-3 text-left hover:bg-[#FCFCFA]"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold leading-tight text-[#111111]">{title}</span>
              <span className={`rounded-[4px] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${optional ? "bg-[#F2F0EA] text-[#111111]/55" : "bg-[var(--color-accent)]/10 text-[var(--color-accent-dark)]"}`}>
                {optional ? "Optional" : "Required"}
              </span>
            </span>
            <span className="mt-1 line-clamp-2 break-words text-xs font-medium leading-snug text-[#111111]/55">
              {summary ?? (optional ? "Not added — you can skip this step" : "Choose an option to continue")}
            </span>
          </span>

          <span className="flex shrink-0 items-center gap-1.5">
            {complete ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[var(--color-accent)]/10 text-[var(--color-accent)]" aria-label="Completed"><Check size={17} strokeWidth={2.4} /></span>
            ) : hasSelection ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[var(--color-cream-soft)] text-[var(--color-accent)]" aria-label="In progress"><Edit2 size={16} strokeWidth={2.2} /></span>
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[var(--color-cream-soft)]" aria-hidden="true"><Plus size={17} strokeWidth={2.2} /></span>
            )}
            <ChevronDown size={16} strokeWidth={2.1} className={`text-[#111111]/45 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </span>
        </button>

        {!hideDelete && hasSelection && !expanded && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Remove ${title} selection`}
            className="my-auto mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-[var(--color-cream-soft)] text-[#C62828] hover:bg-[#FFF0F0]"
          >
            <Trash2 size={15} strokeWidth={2.2} />
          </button>
        )}
      </div>

      {confirmingDelete && !hideDelete && (
        <div role="alertdialog" aria-label={`Remove ${title} selection`} className="flex items-center justify-between gap-3 border-t border-[#F3D9D9] bg-[#FDF3F3] px-4 py-2.5">
          <p className="text-xs font-medium text-[#8A2E2E]">Remove this {title.toLowerCase()} selection?</p>
          <span className="flex shrink-0 items-center gap-1.5">
            <button ref={cancelButtonRef} type="button" onClick={() => setConfirmingDelete(false)} className="techpack-control flex h-8 items-center gap-1 rounded-[4px] border px-2.5 text-xs font-semibold text-[#111111]/70"><X size={13} /> Cancel</button>
            <button type="button" onClick={() => { setConfirmingDelete(false); onDelete(); }} className="flex h-8 items-center gap-1 rounded-[4px] bg-[#C62828] px-2.5 text-xs font-semibold text-white"><Trash2 size={13} /> Remove</button>
          </span>
        </div>
      )}

      <div id={panelId} hidden={!expanded} className="min-h-0 flex-1 overflow-y-auto border-t border-white/55 bg-white/10 px-4 py-4">
        {expanded ? children : null}
      </div>
    </section>
  );
}
