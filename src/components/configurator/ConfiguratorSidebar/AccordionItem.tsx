"use client";

import type { ReactNode } from "react";
import { Check, Edit2, Plus, Trash2 } from "lucide-react";

type AccordionStatus = "empty" | "editable" | "confirmed";

export interface AccordionItemProps {
  title: string;
  summary: string | null;
  confirmed: boolean;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
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
  children,
}: AccordionItemProps) {
  const status = getStatus(summary, confirmed);

  return (
    <div className="overflow-hidden rounded-lg border border-[#E5E1D8] bg-[#FCFBF8]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex min-h-[68px] w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-white"
      >
        <span className="flex flex-col">
          <span className="text-sm font-semibold leading-tight text-[#111111]">{title}</span>
          <span className="mt-1 max-w-[220px] truncate text-xs font-medium text-[#111111]/55">
            {summary ?? "No Selection"}
          </span>
        </span>

        <span className="flex items-center gap-1.5">
          {status === "empty" && (
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F0EEE8]">
              <Plus size={17} strokeWidth={2.2} />
            </span>
          )}
          {status === "editable" && (
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F0EEE8]">
              <Edit2 size={16} strokeWidth={2.2} />
            </span>
          )}
          {status === "confirmed" && (
            <>
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#EAF5EA] text-[#2E7D32]">
                <Check size={17} strokeWidth={2.4} />
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F0EEE8]">
                <Edit2 size={16} strokeWidth={2.2} />
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onDelete();
                  }
                }}
                aria-label={`Remove ${title} selection`}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F0EEE8] text-[#C62828]"
              >
                <Trash2 size={16} strokeWidth={2.2} />
              </span>
            </>
          )}
        </span>
      </button>

      {expanded && <div className="border-t border-[#E5E1D8] bg-white px-4 py-4">{children}</div>}
    </div>
  );
}
