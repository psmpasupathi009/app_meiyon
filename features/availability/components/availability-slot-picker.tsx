"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import {
  formatDisplayDate,
  OfficeDayPicker,
  parseDateKey,
  toDateKey,
} from "@/shared/components/forms/office-day-picker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { formatIstTime } from "@/lib/utils/ist";
import { busySegmentLabel } from "@/features/availability/lib/busy-labels";

type DayAvailability = {
  date: string;
  durationMin: number;
  onLeave: boolean;
  windows: { start: string; end: string }[];
  freeSlots: string[];
  busy: { start: string; end: string; reason: string; label?: string }[];
};

function formatTimeLabel(hhmm: string): string {
  const [hStr, m] = hhmm.split(":");
  let h = Number(hStr);
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function combine(dateKey: string, time: string): string {
  return `${dateKey}T${time}`;
}

function parseValue(value: string): { dateKey: string; time: string } | null {
  if (!value || !value.includes("T")) return null;
  const [dateKey, timePart] = value.split("T");
  return { dateKey, time: timePart.slice(0, 5) };
}

function nextWeekday(from: Date): Date {
  let d = addDays(from, 1);
  // Skip Sunday (0) — office default open Mon–Sat
  for (let i = 0; i < 7; i++) {
    if (d.getDay() !== 0) return d;
    d = addDays(d, 1);
  }
  return d;
}

function formatBusyRange(startIso: string, endIso: string): string {
  return `${formatIstTime(new Date(startIso))} – ${formatIstTime(new Date(endIso))}`;
}

export function AvailabilitySlotPicker({
  advocateMobile,
  durationMin,
  clientUnitId,
  excludeAppointmentUnitId,
  value,
  onChange,
  disabled,
}: {
  advocateMobile: string;
  durationMin: number;
  clientUnitId?: string;
  excludeAppointmentUnitId?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const parsed = parseValue(value);
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const [dateKey, setDateKey] = useState(
    () => parsed?.dateKey ?? toDateKey(today)
  );
  const [avail, setAvail] = useState<DayAvailability | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (parsed?.dateKey && parsed.dateKey !== dateKey) {
      setDateKey(parsed.dateKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when value changes
  }, [value]);

  useEffect(() => {
    if (!advocateMobile || disabled) {
      queueMicrotask(() => setAvail(null));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        setLoading(true);
        setError("");
        const params = new URLSearchParams({
          advocateMobile,
          date: dateKey,
          durationMin: String(durationMin),
        });
        if (clientUnitId) params.set("clientUnitId", clientUnitId);
        if (excludeAppointmentUnitId) {
          params.set("excludeAppointmentUnitId", excludeAppointmentUnitId);
        }
        const { ok, data } = await apiFetch<DayAvailability>(
          `/api/appointments/availability?${params.toString()}`
        );
        if (cancelled) return;
        setLoading(false);
        if (!ok) {
          setAvail(null);
          setError("Could not load free slots");
          return;
        }
        const day = data as unknown as DayAvailability;
        setAvail(day);
        if (parsed?.dateKey === dateKey && parsed.time) {
          if (!day.freeSlots.includes(parsed.time)) {
            onChange("");
          }
        }
      })();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid fetch loops
  }, [
    advocateMobile,
    dateKey,
    durationMin,
    clientUnitId,
    excludeAppointmentUnitId,
    disabled,
  ]);

  const selected = parseDateKey(dateKey);
  const selectedTime = parsed?.dateKey === dateKey ? parsed.time : "";

  const morningSlots =
    avail?.freeSlots.filter((s) => Number(s.slice(0, 2)) < 13) ?? [];
  const afternoonSlots =
    avail?.freeSlots.filter((s) => Number(s.slice(0, 2)) >= 13) ?? [];

  const closedBusy = avail?.busy?.find((b) => b.reason === "closed");
  const officeClosedLabel =
    closedBusy?.label?.trim() ||
    (closedBusy ? "Office closed this day" : null);

  function pickDate(next: string) {
    setDateKey(next);
    onChange("");
  }

  if (!advocateMobile) {
    return (
      <p className="rounded-xl border border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
        Select an advocate to see free times.
      </p>
    );
  }

  return (
    <div
      className={cn("space-y-3", disabled && "pointer-events-none opacity-60")}
    >
      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/25 px-3 py-2.5 text-sm">
        <CalendarClock className="mt-0.5 size-4 shrink-0 text-navy" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-navy">
            {selected && selectedTime
              ? `${formatDisplayDate(selected)} · ${formatTimeLabel(selectedTime)}`
              : selected
                ? `${formatDisplayDate(selected)} · pick a free slot`
                : "Pick a free date and time"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Only open slots · {durationMin} min · Times in India Standard Time
            (IST)
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={dateKey === toDateKey(today) ? "default" : "outline"}
          onClick={() => pickDate(toDateKey(today))}
        >
          Today
        </Button>
        <Button
          type="button"
          size="sm"
          variant={
            dateKey === toDateKey(addDays(today, 1)) ? "default" : "outline"
          }
          onClick={() => pickDate(toDateKey(addDays(today, 1)))}
        >
          Tomorrow
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => pickDate(toDateKey(nextWeekday(today)))}
        >
          Next open day
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <OfficeDayPicker
          compact
          selected={selected}
          onSelect={(d) => {
            if (!d) return;
            pickDate(toDateKey(d));
          }}
          disabled={{ before: today }}
        />

        <div className="flex min-h-56 flex-col rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="shrink-0 border-b border-border/70 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Free slots
            </p>
            {selected ? (
              <p className="mt-0.5 text-sm font-medium text-navy">
                {formatDisplayDate(selected)}
              </p>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-2.5">
            {loading ? (
              <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                Loading free times…
              </p>
            ) : error ? (
              <p className="px-1 py-4 text-center text-xs text-destructive">
                {error}
              </p>
            ) : officeClosedLabel ? (
              <p className="px-1 py-4 text-center text-xs text-amber-700 dark:text-amber-300">
                {officeClosedLabel}
              </p>
            ) : avail?.onLeave ? (
              <p className="px-1 py-4 text-center text-xs text-amber-700 dark:text-amber-300">
                Advocate on approved leave this day
              </p>
            ) : !avail?.freeSlots.length ? (
              <div className="space-y-3">
                <p className="px-1 py-2 text-center text-xs text-muted-foreground">
                  No free slots — try another day or duration
                </p>
                {(avail?.busy?.length ?? 0) > 0 ? (
                  <BusyList busy={avail!.busy} />
                ) : null}
              </div>
            ) : (
              <>
                {morningSlots.length ? (
                  <div className="space-y-1.5">
                    <p className="px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Morning
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {morningSlots.map((slot) => {
                        const active = selectedTime === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => onChange(combine(dateKey, slot))}
                            className={cn(
                              "rounded-lg px-2 py-2.5 text-xs font-semibold transition-colors",
                              active
                                ? "bg-brand text-brand-foreground shadow-sm"
                                : "bg-muted/60 text-navy hover:bg-muted"
                            )}
                          >
                            {formatTimeLabel(slot)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {afternoonSlots.length ? (
                  <div className="space-y-1.5">
                    <p className="px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Afternoon
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {afternoonSlots.map((slot) => {
                        const active = selectedTime === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => onChange(combine(dateKey, slot))}
                            className={cn(
                              "rounded-lg px-2 py-2.5 text-xs font-semibold transition-colors",
                              active
                                ? "bg-brand text-brand-foreground shadow-sm"
                                : "bg-muted/60 text-navy hover:bg-muted"
                            )}
                          >
                            {formatTimeLabel(slot)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {(avail?.busy?.length ?? 0) > 0 ? (
                  <BusyList busy={avail!.busy} />
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BusyList({
  busy,
}: {
  busy: { start: string; end: string; reason: string; label?: string }[];
}) {
  const rows = busy.filter((b) => b.reason !== "closed");
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1.5 rounded-lg border border-border/70 bg-muted/30 px-2.5 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Unavailable
      </p>
      <ul className="space-y-1">
        {rows.slice(0, 6).map((b) => (
          <li
            key={`${b.start}-${b.end}-${b.reason}`}
            className="flex items-start justify-between gap-2 text-xs"
          >
            <span className="min-w-0 font-medium text-navy">
              {b.label?.trim() ||
                busySegmentLabel({
                  reason: b.reason,
                  label: b.label,
                })}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatBusyRange(b.start, b.end)}
            </span>
          </li>
        ))}
        {rows.length > 6 ? (
          <li className="text-[11px] text-muted-foreground">
            +{rows.length - 6} more
          </li>
        ) : null}
      </ul>
    </div>
  );
}
