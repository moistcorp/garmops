"use client";

import { useMemo, useState } from "react";
import { getDeliveryOptions } from "@/lib/configurator/delivery";

export interface DeliveryDatePickerProps {
  orderConfirmedDate?: Date;
  extraLeadTimeDays?: number;
  onDateSelect: (date: Date, type: "rush" | "standard" | "flexible") => void;
  selectedDate?: Date;
  selectedType?: "rush" | "standard" | "flexible";
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromInputValue(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function DeliveryDatePicker({
  orderConfirmedDate,
  extraLeadTimeDays = 0,
  onDateSelect,
  selectedDate,
  selectedType,
}: DeliveryDatePickerProps) {
  const baseDate = useMemo(() => orderConfirmedDate ?? new Date(), [orderConfirmedDate]);
  const [userCalendarOpen, setUserCalendarOpen] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const options = useMemo(
    () => getDeliveryOptions(baseDate, extraLeadTimeDays),
    [baseDate, extraLeadTimeDays]
  );

  const chipClass = (active: boolean) =>
    `flex-1 rounded-md border px-4 py-3 text-left transition-colors ${
      active
        ? "border-[var(--color-teal)] bg-[var(--color-teal)] text-white"
        : "border-[#E5E5E5] bg-[#F7F7F7] text-[#111111] hover:border-[var(--color-teal)]"
    }`;

  const isSame = (a?: Date, b?: Date) =>
    !!a && !!b && a.toDateString() === b.toDateString();

  const isFlexibleSelected = selectedType === "flexible" && !!selectedDate;
  const showCalendar = isFlexibleSelected || userCalendarOpen;

  const handleFlexiblePick = (dateStr: string) => {
    const picked = fromInputValue(dateStr);
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
          className={chipClass(selectedType === "rush" || (!selectedType && isSame(selectedDate, options.rush)))}
          onClick={() => {
            setUserCalendarOpen(false);
            onDateSelect(options.rush, "rush");
          }}
        >
          <span className="block text-sm font-medium">Rush</span>
          <span className="block text-xs opacity-70">
            {formatDate(options.rush)} · +₹75/unit
          </span>
        </button>

        <button
          type="button"
          className={chipClass(
            selectedType === "standard" || (!selectedType && isSame(selectedDate, options.standard))
          )}
          onClick={() => {
            setUserCalendarOpen(false);
            onDateSelect(options.standard, "standard");
          }}
        >
          <span className="block text-sm font-medium">Standard</span>
          <span className="block text-xs opacity-70">
            {formatDate(options.standard)}
          </span>
        </button>

        <button
          type="button"
          className={chipClass(isFlexibleSelected || showCalendar)}
          onClick={() => setUserCalendarOpen((s) => !s)}
        >
          <span className="block text-sm font-medium">Flexible</span>
          <span className="block text-xs opacity-70">
            {isFlexibleSelected ? formatDate(selectedDate) : "Pick another date"}
          </span>
        </button>
      </div>

      {showCalendar && (
        <div className="space-y-2 rounded-md border border-[#E5E5E5] bg-[#F7F7F7] p-3">
          <input
            type="date"
            min={toInputValue(options.standard)}
            value={isFlexibleSelected ? toInputValue(selectedDate) : ""}
            className="rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#111111] focus:border-[var(--color-teal)] focus:outline-none"
            onChange={(e) => handleFlexiblePick(e.target.value)}
          />
          {calendarError && (
            <p className="text-xs text-red-600">{calendarError}</p>
          )}
        </div>
      )}

      <div className="text-xs text-[#111111]/60 space-y-1 pt-1">
        <p>Rush adds ₹75 per unit to the invoice.</p>
        <p>Standard follows the regular production and shipping timeline.</p>
        {extraLeadTimeDays > 0 && (
          <p>Custom dye adds {extraLeadTimeDays} production days to these estimates.</p>
        )}
        <p>Flexible dates are available on or after the standard date.</p>
      </div>
    </div>
  );
}
