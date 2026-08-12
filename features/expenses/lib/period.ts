import {
  istAddCalendarDays,
  istDateKey,
  istDayBounds,
} from "@/lib/utils/ist";
import {
  dayKeyToFromIso,
  dayKeyToToIso,
  thisMonthBounds,
} from "@/features/accounts/lib/period";

export type ExpensePeriodPreset =
  | "all"
  | "today"
  | "week"
  | "month"
  | "custom";

export { dayKeyToFromIso, dayKeyToToIso, thisMonthBounds };

/** Today (IST) as ISO from/to bounds. */
export function todayBounds(now = new Date()): { from: string; to: string } {
  const key = istDateKey(now);
  return {
    from: istDayBounds(key).start.toISOString(),
    to: istDayBounds(key).end.toISOString(),
  };
}

/**
 * Current office week Mon–Sun in IST.
 * Uses noon IST so DST/offset edge cases don’t shift the calendar day.
 */
export function thisWeekBounds(now = new Date()): { from: string; to: string } {
  const key = istDateKey(now);
  const noon = new Date(`${key}T12:00:00+05:30`);
  // getUTCDay with IST noon: Mon=1 … Sun=0
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
  }).format(noon);
  const offsetFromMonday: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const back = offsetFromMonday[weekday] ?? 0;
  const fromKey = istAddCalendarDays(key, -back);
  const toKey = istAddCalendarDays(fromKey, 6);
  return {
    from: istDayBounds(fromKey).start.toISOString(),
    to: istDayBounds(toKey).end.toISOString(),
  };
}
