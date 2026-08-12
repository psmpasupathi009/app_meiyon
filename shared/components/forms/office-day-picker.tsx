"use client";

import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils/cn";
import "react-day-picker/style.css";

export function calendarClassNames(compact = false) {
  return {
    root: cn("w-full", compact ? "text-sm" : ""),
    months: "relative flex w-full flex-col",
    month: "w-full",
    month_caption: "mb-3 flex items-center justify-center pt-1",
    caption_label: "text-sm font-semibold tracking-tight text-navy",
    nav: "absolute inset-x-0 top-0 flex items-center justify-between px-0.5",
    button_previous:
      "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-navy",
    button_next:
      "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-navy",
    month_grid: "w-full border-collapse",
    weekdays: "flex w-full",
    weekday:
      "w-[14.28%] pb-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
    week: "mt-0.5 flex w-full",
    day: "relative w-[14.28%] p-0.5 text-center",
    day_button: cn(
      "mx-auto flex size-8 items-center justify-center rounded-full text-sm transition-colors sm:size-9",
      "hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/30"
    ),
    selected:
      "[&>button]:bg-brand [&>button]:font-semibold [&>button]:text-brand-foreground [&>button]:shadow-sm [&>button]:hover:bg-brand [&>button]:hover:text-brand-foreground",
    today:
      "[&>button]:font-semibold [&>button]:text-navy [&>button]:ring-1 [&>button]:ring-gold/70",
    outside: "[&>button]:text-muted-foreground/35",
    disabled: "[&>button]:pointer-events-none [&>button]:opacity-30",
    hidden: "invisible",
  } as const;
}

export function OfficeDayPicker({
  selected,
  onSelect,
  disabled,
  className,
  compact = false,
}: {
  selected?: Date;
  onSelect: (date: Date | undefined) => void;
  disabled?: Parameters<typeof DayPicker>[0]["disabled"];
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-card shadow-sm",
        compact ? "p-2" : "p-2.5 sm:p-3",
        className
      )}
    >
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={onSelect}
        disabled={disabled}
        showOutsideDays
        classNames={calendarClassNames(compact)}
      />
    </div>
  );
}

export function toDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
