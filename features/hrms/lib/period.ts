import { istAddCalendarDays, istDateKey } from "@/lib/utils/ist";

export type HistoryPeriod = "month" | "30d" | "custom";

/** Calendar month bounds as YYYY-MM-DD (attendance `from`/`to`). */
export function thisMonthDateKeys(now = new Date()): { from: string; to: string } {
  const key = istDateKey(now);
  const [y, m] = key.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  const firstOfNext = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  const to = istAddCalendarDays(firstOfNext, -1);
  return { from, to };
}

export function last30DateKeys(now = new Date()): { from: string; to: string } {
  const to = istDateKey(now);
  const from = istAddCalendarDays(to, -29);
  return { from, to };
}
