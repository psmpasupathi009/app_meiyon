"use client";

import type { ReactNode } from "react";
import { Coffee, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import { WeekHoursPreview } from "@/features/availability/components/week-hours-preview";

export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" },
];

export type WeeklyHoursCardProps = {
  header?: ReactNode;
  canEdit: boolean;
  loading: boolean;
  savingHours: boolean;
  dirty: boolean;
  openDays: Set<number>;
  workStart: string;
  workEnd: string;
  hasBreak: boolean;
  breakStart: string;
  breakEnd: string;
  onToggleDay: (weekday: number) => void;
  onWorkStartChange: (value: string) => void;
  onWorkEndChange: (value: string) => void;
  onHasBreakChange: (value: boolean) => void;
  onBreakStartChange: (value: string) => void;
  onBreakEndChange: (value: string) => void;
  onSave: () => void;
};

export function WeeklyHoursCard({
  header,
  canEdit,
  loading,
  savingHours,
  dirty,
  openDays,
  workStart,
  workEnd,
  hasBreak,
  breakStart,
  breakEnd,
  onToggleDay,
  onWorkStartChange,
  onWorkEndChange,
  onHasBreakChange,
  onBreakStartChange,
  onBreakEndChange,
  onSave,
}: WeeklyHoursCardProps) {
  const saveButton = canEdit ? (
    <Button
      type="button"
      className={cn(
        "h-11 gap-2 px-4 transition-all",
        dirty && !savingHours && "shadow-md ring-2 ring-gold/40"
      )}
      onClick={onSave}
      disabled={savingHours || loading || (!dirty && !savingHours)}
    >
      <Save className="size-4" />
      {savingHours ? "Saving…" : dirty ? "Save schedule" : "Saved"}
    </Button>
  ) : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      {header ? (
        <div className="border-b border-border/70 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {header}
            <div className="hidden sm:block">{saveButton}</div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,19rem)_1fr] lg:p-5">
          <div className="order-2 space-y-3 lg:order-1">
            <div className="h-28 animate-pulse rounded-2xl bg-muted/40" />
            <div className="h-36 animate-pulse rounded-2xl bg-muted/40" />
          </div>
          <div className="order-1 h-56 animate-pulse rounded-2xl bg-muted/40 lg:order-2" />
        </div>
      ) : (
        <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,19rem)_1fr] lg:gap-8 lg:p-5">
          {/* Week board first on mobile — primary interaction */}
          <div className="order-1 rounded-2xl border border-border/70 bg-muted/20 p-3 sm:p-4 lg:order-2">
            <WeekHoursPreview
              openDays={openDays}
              workStart={workStart}
              workEnd={workEnd}
              hasBreak={hasBreak}
              breakStart={breakStart}
              breakEnd={breakEnd}
              canEdit={canEdit}
              onToggleDay={onToggleDay}
            />
          </div>

          <div className="order-2 space-y-5 lg:order-1">
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Working hours
                </Label>
                <span className="text-[11px] text-muted-foreground/80">
                  Same every open day
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="workStart"
                    className="text-xs text-muted-foreground"
                  >
                    Opens
                  </Label>
                  <Input
                    id="workStart"
                    type="time"
                    value={workStart}
                    disabled={!canEdit}
                    onChange={(e) => onWorkStartChange(e.target.value)}
                    className="h-11 tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="workEnd"
                    className="text-xs text-muted-foreground"
                  >
                    Closes
                  </Label>
                  <Input
                    id="workEnd"
                    type="time"
                    value={workEnd}
                    disabled={!canEdit}
                    onChange={(e) => onWorkEndChange(e.target.value)}
                    className="h-11 tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div
              className={cn(
                "rounded-2xl border p-3.5 transition-colors sm:p-4",
                hasBreak
                  ? "border-gold/40 bg-gold/[0.07]"
                  : "border-dashed border-border/90 bg-muted/15"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                      hasBreak
                        ? "bg-gold/25 text-navy"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Coffee className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy">
                      Daily break
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      Lunch gap on every open day.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={hasBreak}
                  disabled={!canEdit}
                  onClick={() => canEdit && onHasBreakChange(!hasBreak)}
                  className={cn(
                    "relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30",
                    hasBreak ? "bg-brand" : "bg-muted",
                    !canEdit && "cursor-default opacity-70"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow-sm transition-transform",
                      hasBreak && "translate-x-5"
                    )}
                  />
                </button>
              </div>
              {hasBreak ? (
                <div className="mt-3 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="breakStart"
                      className="text-xs text-muted-foreground"
                    >
                      From
                    </Label>
                    <Input
                      id="breakStart"
                      type="time"
                      value={breakStart}
                      disabled={!canEdit}
                      onChange={(e) => onBreakStartChange(e.target.value)}
                      className="h-11 tabular-nums"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="breakEnd"
                      className="text-xs text-muted-foreground"
                    >
                      To
                    </Label>
                    <Input
                      id="breakEnd"
                      type="time"
                      value={breakEnd}
                      disabled={!canEdit}
                      onChange={(e) => onBreakEndChange(e.target.value)}
                      className="h-11 tabular-nums"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <p className="hidden text-xs leading-relaxed text-muted-foreground lg:block">
              Booking only offers free slots inside open hours — after time away
              and approved leave.
            </p>

            {canEdit ? (
              <div className="sm:hidden">{saveButton}</div>
            ) : null}
          </div>
        </div>
      )}

      {canEdit && dirty ? (
        <div className="sticky bottom-0 z-10 border-t border-border/70 bg-card/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-card/80 sm:hidden">
          <Button
            type="button"
            className="h-11 w-full gap-2 shadow-md ring-2 ring-gold/40"
            onClick={onSave}
            disabled={savingHours || loading}
          >
            <Save className="size-4" />
            {savingHours ? "Saving…" : "Save schedule"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
