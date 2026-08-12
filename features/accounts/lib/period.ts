import { istAddCalendarDays, istDateKey, istDayBounds } from "@/lib/utils/ist";

export type PeriodPreset = "all" | "month" | "fy" | "custom";

/** Indian financial year (Apr–Mar) bounds in IST, as ISO strings for API `from`/`to`. */
export function indianFyBounds(now = new Date()): { from: string; to: string } {
  const key = istDateKey(now);
  const [y, m] = key.split("-").map(Number);
  const fyStartYear = m >= 4 ? y : y - 1;
  const fromKey = `${fyStartYear}-04-01`;
  const toKey = `${fyStartYear + 1}-03-31`;
  return {
    from: istDayBounds(fromKey).start.toISOString(),
    to: istDayBounds(toKey).end.toISOString(),
  };
}

/** Calendar month bounds in IST (no local TZ math). */
export function thisMonthBounds(now = new Date()): { from: string; to: string } {
  const key = istDateKey(now);
  const [y, m] = key.split("-").map(Number);
  const fromKey = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  const firstOfNext = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  const toKey = istAddCalendarDays(firstOfNext, -1);
  return {
    from: istDayBounds(fromKey).start.toISOString(),
    to: istDayBounds(toKey).end.toISOString(),
  };
}

/** Convert YYYY-MM-DD (date input) to API ISO bounds. */
export function dayKeyToFromIso(dateKey: string): string {
  return istDayBounds(dateKey).start.toISOString();
}

export function dayKeyToToIso(dateKey: string): string {
  return istDayBounds(dateKey).end.toISOString();
}
