"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Edit2, Plus, Trash2, X } from "lucide-react";

type AccordionStatus = "empty" | "editable" | "confirmed";

export interface AccordionItemProps {
  title: string;
  summary: string | null;
  confirmed: boolean;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  /** Suppresses the trash/reset control entirely — used for steps like
   *  Garment Colour where there's always a valid value (a colour is always
   *  selected, just possibly unconfirmed) so "remove this selection" isn't
   *  a meaningful action. */
  hideDelete?: boolean;
  children: ReactNode;
}

function getStatus(summary: string | null, confirmed: boolean): AccordionStatus {
  if (summary == null) return "empty";
  return confirmed ? "confirmed" : "editable";
}

export function AccordionItem({
  title,
  summary,
  confirmed,
  expanded,
  onToggle,
  onDelete,
  hideDelete = false,
  children,
}: AccordionItemProps) {
  const status = getStatus(summary, confirmed);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmingDelete) {
      cancelButtonRef.current?.focus();
    }
  }, [confirmingDelete]);

  function handleToggle() {
    setConfirmingDelete(false);
    onToggle();
  }

  function handleTrashClick(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation();
    setConfirmingDelete(true);
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmingDelete(false);
  }

  function handleConfirmDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmingDelete(false);
    onDelete();
  }

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-[28px] border bg-white shadow-[0_4px_16px_rgba(22,33,43,0.04)] ${
        expanded ? "border-[var(--color-teal)]" : "border-[#ECE7DF]"
      } ${
        expanded ? "flex-1" : "shrink-0"
      }`}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
        className="flex min-h-[68px] w-full items-start justify-between gap-4 px-4 py-3 text-left hover:bg-white"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold leading-tight text-[#111111]">{title}</span>
          <span className="mt-1 line-clamp-2 break-words text-xs font-medium leading-snug text-[#111111]/55">
            {summary ?? "No Selection"}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          {status === "empty" && (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-cream-soft)]">
              <Plus size={17} strokeWidth={2.2} />
            </span>
          )}
          {status === "editable" && (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-cream-soft)] text-[var(--color-teal)]">
              <Edit2 size={16} strokeWidth={2.2} />
            </span>
          )}
          {status === "confirmed" && (
            <>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-teal)]/10 text-[var(--color-teal)]">
                <Check size={17} strokeWidth={2.4} />
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-cream-soft)] text-[var(--color-teal)]">
                <Edit2 size={16} strokeWidth={2.2} />
              </span>
              {!hideDelete && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleTrashClick}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleTrashClick(e);
                    }
                  }}
                  aria-label={`Remove ${title} selection`}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-cream-soft)] text-[#C62828]"
                >
                  <Trash2 size={16} strokeWidth={2.2} />
                </span>
              )}
            </>
          )}
        </span>
      </button>

      {/* Delete confirmation bar — grid-rows trick animates height without
          needing to measure content, and without an abrupt snap. */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
          confirmingDelete && confirmed && !hideDelete ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-t border-[#F3D9D9] bg-[#FDF3F3] px-4 py-2.5">
            <p className="text-xs font-medium text-[#8A2E2E]">
              Remove this {title.toLowerCase()} selection? This can&rsquo;t be undone.
            </p>
            <span className="flex shrink-0 items-center gap-1.5">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={handleCancelDelete}
                className="flex h-7 items-center gap-1 rounded-full border border-[#E5E5E5] bg-white px-2 text-xs font-semibold text-[#111111]/70 hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"
              >
                <X size={13} strokeWidth={2.4} />
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex h-7 items-center gap-1 rounded-md bg-[#C62828] px-2 text-xs font-semibold text-white hover:opacity-90"
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