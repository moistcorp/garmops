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
    <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_1px_0_rgba(17,17,17,0.03)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex min-h-[78px] w-full items-center justify-between gap-4 px-5 py-3 text-left"
      >
        <span className="flex flex-col">
          <span className="text-[22px] font-bold leading-tight tracking-tight text-[#111111]">{title}</span>
          <span className="mt-1.5 text-xs font-semibold text-[#111111]/75">
            {summary ?? "No Selection"}
          </span>
        </span>

        <span className="flex items-center gap-1.5">
          {status === "empty" && (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3F3F2]">
              <Plus size={17} strokeWidth={2.2} />
            </span>
          )}
          {status === "editable" && (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3F3F2]">
              <Edit2 size={16} strokeWidth={2.2} />
            </span>
          )}
          {status === "confirmed" && (
            <>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EAF5EA] text-[#2E7D32]">
                <Check size={17} strokeWidth={2.4} />
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3F3F2]">
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
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3F3F2] text-[#C62828]"
              >
                <Trash2 size={16} strokeWidth={2.2} />
              </span>
            </>
          )}
        </span>
      </button>

      {expanded && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}
