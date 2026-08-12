import { bookingDefaults } from "@/config/company/booking";

export type HoursDay = {
  weekday: number;
  ranges: { startTime: string; endTime: string }[];
};

export type InferredSchedule = {
  openDays: Set<number>;
  workStart: string;
  workEnd: string;
  breakStart: string;
  breakEnd: string;
  hasBreak: boolean;
};

/**
 * Infer the simplified UI schedule from stored day ranges.
 * When usingDefaults is false and every day is empty, the week was explicitly
 * closed (CLOSED_WEEK_SENTINEL) — do not fall back to office defaults.
 */
export function inferSchedule(
  days: HoursDay[],
  usingDefaults: boolean
): InferredSchedule {
  const openDays = new Set<number>();
  let workStart = bookingDefaults.workStart;
  let workEnd = bookingDefaults.workEnd;
  let breakStart = bookingDefaults.breakStart;
  let breakEnd = bookingDefaults.breakEnd;
  let hasBreak = true;

  const withRanges = days.filter((d) =>
    d.ranges.some((r) => r.startTime < r.endTime)
  );

  if (withRanges.length === 0) {
    return {
      openDays: usingDefaults
        ? new Set(bookingDefaults.defaultOpenWeekdays)
        : new Set(),
      workStart,
      workEnd,
      breakStart,
      breakEnd,
      hasBreak: true,
    };
  }

  for (const d of withRanges) openDays.add(d.weekday);

  const starts = withRanges.flatMap((d) => d.ranges.map((r) => r.startTime));
  const ends = withRanges.flatMap((d) => d.ranges.map((r) => r.endTime));
  workStart = starts.sort()[0] ?? workStart;
  workEnd = ends.sort().at(-1) ?? workEnd;

  const twoRangeDays = withRanges.filter((d) => d.ranges.length >= 2);
  if (twoRangeDays.length > 0) {
    const sample = [...twoRangeDays[0]!.ranges].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );
    breakStart = sample[0]!.endTime;
    breakEnd = sample[1]!.startTime;
    hasBreak = breakStart < breakEnd;
  } else {
    hasBreak = false;
    breakStart = bookingDefaults.breakStart;
    breakEnd = bookingDefaults.breakEnd;
  }

  return { openDays, workStart, workEnd, breakStart, breakEnd, hasBreak };
}

/** Normalize to HH:mm for API validation. */
export function normalizeHm(value: string): string {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h) || Number.isNaN(m) || h > 23 || m > 59) return value;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
