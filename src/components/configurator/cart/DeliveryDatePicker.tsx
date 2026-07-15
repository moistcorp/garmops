"use client";

import { useMemo, useState } from "react";
import { getDeliveryOptions } from "@/lib/configurator/delivery";

export interface DeliveryDatePickerProps {
  orderConfirmedDate?: Date;
  onDateSelect: (date: Date, type: "rush" | "standard" | "flexible") => void;
  selectedDate?: Date;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toInputValue(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function DeliveryDatePicker({
  orderConfirmedDate,
  onDateSelect,
  selectedDate,
}: DeliveryDatePickerProps) {
  const [baseDate] = useState<Date>(orderConfirmedDate ?? new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const options = useMemo(() => getDeliveryOptions(baseDate), [baseDate]);

  const chipClass = (active: boolean) =>
    `flex-1 border px-4 py-3 text-left transition-colors ${
      active
        ? "border-[#111111] bg-[#111111] text-[#F7F7F7]"
        : "border-[#E5E5E5] bg-[#F7F7F7] text-[#111111] hover:border-[#111111]"
    }`;

  const isSame = (a?: Date, b?: Date) =>
    !!a && !!b && a.toDateString() === b.toDateString();

  const handleFlexiblePick = (dateStr: string) => {
    const picked = new Date(dateStr);
    if (!options.flexible(picked)) {
      setCalendarError(
        `Pick a date on or after ${formatDate(options.standard)}.`
      );
      return;
    }
    setCalendarError(null);
    onDateSelect(picked, "flexible");
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-[#111111]">
        Select your preferred delivery date
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          className={chipClass(isSame(selectedDate, options.rush))}
          onClick={() => {
            setShowCalendar(false);
            onDateSelect(options.rush, "rush");
          }}
        >
          <span className="block text-sm font-medium">⚡ Express</span>
          <span className="block text-xs opacity-70">
            {formatDate(options.rush)}
          </span>
        </button>

        <button
          type="button"
          className={chipClass(isSame(selectedDate, options.standard))}
          onClick={() => {
            setShowCalendar(false);
            onDateSelect(options.standard, "standard");
          }}
        >
          <span className="block text-sm font-medium">🚚 Standard</span>
          <span className="block text-xs opacity-70">
            {formatDate(options.standard)}
          </span>
        </button>

        <button
          type="button"
          className={chipClass(showCalendar)}
          onClick={() => setShowCalendar((s) => !s)}
        >
          <span className="block text-sm font-medium">🕐 Flexible</span>
          <span className="block text-xs opacity-70">Pick another date</span>
        </button>
      </div>

      {showCalendar && (
        <div className="border border-[#E5E5E5] bg-[#F7F7F7] p-3 space-y-2">
          <input
            type="date"
            min={toInputValue(options.standard)}
            className="border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111]"
            onChange={(e) => handleFlexiblePick(e.target.value)}
          />
          {calendarError && (
            <p className="text-xs text-red-600">{calendarError}</p>
          )}
        </div>
      )}

      <div className="text-xs text-[#111111]/60 space-y-1 pt-1">
        <p>⚡ Express — fastest available turnaround</p>
        <p>🚚 Standard — our regular production and shipping timeline</p>
        <p>🕐 Flexible — choose any date on or after the standard date</p>
      </div>
    </div>
  );
}