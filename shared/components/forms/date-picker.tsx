"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import {
  formatDisplayDate,
  OfficeDayPicker,
  parseDateKey,
  toDateKey,
} from "@/shared/components/forms/office-day-picker";
import { cn } from "@/lib/utils/cn";

type DatePickerProps = {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  minDate?: Date;
  className?: string;
  id?: string;
  /** Keep calendar always visible (case forms). Default: expand on tap. */
  alwaysOpen?: boolean;
};

export function DatePicker({
  value,
  onChange,
  minDate,
  className,
  id,
  alwaysOpen = false,
}: DatePickerProps) {
  const selected = parseDateKey(value);
  const [expanded, setExpanded] = useState(alwaysOpen);

  const showCalendar = alwaysOpen || expanded;

  return (
    <div className={cn("space-y-2", className)} id={id}>
      {!alwaysOpen ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-11 w-full items-center justify-between rounded-xl border border-input bg-card px-3 text-left text-sm shadow-sm transition-colors hover:bg-muted/40"
        >
          <span className="flex items-center gap-2 text-navy">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            {selected ? formatDisplayDate(selected) : "Select date"}
          </span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>
      ) : null}

      {showCalendar ? (
        <OfficeDayPicker
          selected={selected}
          onSelect={(d) => {
            if (!d) return;
            onChange(toDateKey(d));
            if (!alwaysOpen) setExpanded(false);
          }}
          disabled={minDate ? [{ before: minDate }] : undefined}
        />
      ) : null}
    </div>
  );
}
