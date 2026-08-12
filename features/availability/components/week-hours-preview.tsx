"use client";

import { rangesFromWorkAndBreak } from "@/config/company/booking";
import { cn } from "@/lib/utils/cn";

const WEEKDAYS: { value: number; short: string; letter: string }[] = [
  { value: 1, short: "Mon", letter: "M" },
  { value: 2, short: "Tue", letter: "T" },
  { value: 3, short: "Wed", letter: "W" },
  { value: 4, short: "Thu", letter: "T" },
  { value: 5, short: "Fri", letter: "F" },
  { value: 6, short: "Sat", letter: "S" },
  { value: 0, short: "Sun", letter: "S" },
];

/** Fixed board window (minutes from midnight) — 08:00–20:00 IST. */
const PREVIEW_START = 8 * 60;
const PREVIEW_END = 20 * 60;
const PREVIEW_SPAN = PREVIEW_END - PREVIEW_START;
const HOUR_MARKS = [8, 10, 12, 14, 16, 18, 20];
/** Matches day-label row above the track so hour ticks align. */
const DAY_LABEL_OFFSET = "1.75rem";

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function clampPct(minutes: number): number {
  const clamped = Math.min(PREVIEW_END, Math.max(PREVIEW_START, minutes));
  return ((clamped - PREVIEW_START) / PREVIEW_SPAN) * 100;
}

function formatHmLabel(hhmm: string): string {
  const [hStr, m] = hhmm.split(":");
  let h = Number(hStr);
  const ampm = h >= 12 ? "pm" : "am";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return m === "00" ? `${h}${ampm}` : `${h}:${m}${ampm}`;
}

export type WeekHoursPreviewProps = {
  openDays: Set<number>;
  workStart: string;
  workEnd: string;
  hasBreak: boolean;
  breakStart: string;
  breakEnd: string;
  canEdit?: boolean;
  onToggleDay?: (weekday: number) => void;
};

export function WeekHoursPreview({
  openDays,
  workStart,
  workEnd,
  hasBreak,
  breakStart,
  breakEnd,
  canEdit = false,
  onToggleDay,
}: WeekHoursPreviewProps) {
  const ranges =
    workStart < workEnd
      ? rangesFromWorkAndBreak({
          workStart,
          workEnd,
          breakStart: hasBreak ? breakStart : undefined,
          breakEnd: hasBreak ? breakEnd : undefined,
        })
      : [];

  const showBreakGap =
    hasBreak &&
    breakStart < breakEnd &&
    breakStart > workStart &&
    breakEnd < workEnd;

  const openCount = openDays.size;
  const summary =
    openCount === 0
      ? "No bookable days"
      : `${openCount} day${openCount === 1 ? "" : "s"} · ${formatHmLabel(workStart)}–${formatHmLabel(workEnd)}${
          showBreakGap
            ? ` · break ${formatHmLabel(breakStart)}–${formatHmLabel(breakEnd)}`
            : ""
        }`;

  function renderBreakGap(orientation: "vertical" | "horizontal") {
    if (!showBreakGap) return null;
    const start = timeToMinutes(breakStart);
    const end = timeToMinutes(breakEnd);
    if (orientation === "vertical") {
      const top = clampPct(start);
      const height = Math.max(0, clampPct(end) - top);
      if (height <= 0) return null;
      return (
        <span
          className="absolute inset-x-1 rounded-sm bg-gold/35"
          style={{ top: `${top}%`, height: `${height}%` }}
          aria-hidden
        />
      );
    }
    const left = clampPct(start);
    const width = Math.max(0, clampPct(end) - left);
    if (width <= 0) return null;
    return (
      <span
        className="absolute inset-y-0 rounded-full bg-gold/50"
        style={{ left: `${left}%`, width: `${width}%` }}
        aria-hidden
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Your week
          </p>
          <p className="mt-0.5 text-sm font-medium tabular-nums text-navy">
            {summary}
          </p>
        </div>
        {canEdit ? (
          <p className="text-xs text-muted-foreground">
            Tap a day to open or close
          </p>
        ) : null}
      </div>

      <div className="hidden sm:block">
        <div className="grid grid-cols-[2.25rem_repeat(7,minmax(0,1fr))] gap-1.5 md:gap-2">
          <div
            className="relative"
            style={{
              marginTop: DAY_LABEL_OFFSET,
              height: "10rem",
            }}
          >
            {HOUR_MARKS.map((hour) => {
              const top = clampPct(hour * 60);
              return (
                <span
                  key={hour}
                  className="absolute right-0.5 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground/80"
                  style={{ top: `${top}%` }}
                >
                  {hour === 12 ? "12" : hour > 12 ? hour - 12 : hour}
                </span>
              );
            })}
          </div>
          {WEEKDAYS.map((d) => {
            const open = openDays.has(d.value);
            const interactive = Boolean(canEdit && onToggleDay);
            const columnClass = cn(
              "group flex flex-col gap-1.5 rounded-2xl border p-1.5 text-left transition-all md:p-2",
              open
                ? "border-navy/25 bg-card shadow-sm"
                : "border-border/60 bg-muted/30",
              interactive &&
                "hover:border-navy/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30"
            );
            const columnInner = (
              <>
                <span
                  className={cn(
                    "flex h-5 items-center justify-center text-center text-[11px] font-semibold uppercase tracking-wide",
                    open ? "text-navy" : "text-muted-foreground"
                  )}
                >
                  {d.short}
                </span>
                <div
                  className={cn(
                    "relative h-40 w-full overflow-hidden rounded-xl",
                    open ? "bg-navy/6" : "bg-muted/50"
                  )}
                >
                  {HOUR_MARKS.slice(1, -1).map((hour) => (
                    <span
                      key={hour}
                      className="absolute inset-x-0 border-t border-border/40"
                      style={{ top: `${clampPct(hour * 60)}%` }}
                    />
                  ))}
                  {open ? (
                    <>
                      {renderBreakGap("vertical")}
                      {ranges.map((r) => {
                        const top = clampPct(timeToMinutes(r.startTime));
                        const bottom = clampPct(timeToMinutes(r.endTime));
                        const height = Math.max(0, bottom - top);
                        if (height <= 0) return null;
                        return (
                          <span
                            key={`${r.startTime}-${r.endTime}`}
                            className="absolute inset-x-1 z-10 rounded-md bg-brand shadow-sm transition-colors group-hover:brightness-110"
                            style={{ top: `${top}%`, height: `${height}%` }}
                          />
                        );
                      })}
                    </>
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-muted-foreground/70">
                      Off
                    </span>
                  )}
                </div>
              </>
            );
            if (interactive) {
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => onToggleDay?.(d.value)}
                  className={columnClass}
                  aria-pressed={open}
                  aria-label={
                    open
                      ? `${d.short} open ${workStart}–${workEnd}. Toggle to close.`
                      : `${d.short} closed. Toggle to open.`
                  }
                >
                  {columnInner}
                </button>
              );
            }
            return (
              <div key={d.value} className={columnClass}>
                {columnInner}
              </div>
            );
          })}
        </div>
      </div>

      <ul className="space-y-2 sm:hidden">
        {WEEKDAYS.map((d) => {
          const open = openDays.has(d.value);
          const interactive = Boolean(canEdit && onToggleDay);
          const rowClass = cn(
            "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all",
            open
              ? "border-navy/25 bg-card shadow-sm"
              : "border-border/60 bg-muted/30",
            interactive && "active:scale-[0.99]"
          );
          const rowInner = (
            <>
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold",
                  open
                    ? "bg-brand text-brand-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {d.letter}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      open ? "text-navy" : "text-muted-foreground"
                    )}
                  >
                    {d.short}
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {open ? `${workStart}–${workEnd}` : "Closed"}
                  </span>
                </div>
                <div
                  className={cn(
                    "relative mt-2 h-2.5 w-full overflow-hidden rounded-full",
                    open ? "bg-navy/10" : "bg-muted"
                  )}
                >
                  {open ? (
                    <>
                      {renderBreakGap("horizontal")}
                      {ranges.map((r) => {
                        const left = clampPct(timeToMinutes(r.startTime));
                        const right = clampPct(timeToMinutes(r.endTime));
                        const width = Math.max(0, right - left);
                        if (width <= 0) return null;
                        return (
                          <span
                            key={`${r.startTime}-${r.endTime}`}
                            className="absolute inset-y-0 z-10 rounded-full bg-brand"
                            style={{ left: `${left}%`, width: `${width}%` }}
                          />
                        );
                      })}
                    </>
                  ) : null}
                </div>
              </div>
            </>
          );
          return (
            <li key={d.value}>
              {interactive ? (
                <button
                  type="button"
                  onClick={() => onToggleDay?.(d.value)}
                  className={rowClass}
                  aria-pressed={open}
                >
                  {rowInner}
                </button>
              ) : (
                <div className={rowClass}>{rowInner}</div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-brand" />
          Bookable
        </span>
        {showBreakGap ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-gold/50" />
            Break
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-muted ring-1 ring-border/80" />
          Closed
        </span>
        <span className="ml-auto tabular-nums">08:00–20:00 IST</span>
      </div>
    </div>
  );
}
