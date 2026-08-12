const IST_TZ = "Asia/Kolkata";

/** IST calendar day as YYYY-MM-DD — the app's canonical "business date". */
export function istDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST_TZ }).format(date);
}

export function istDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function istDisplayWeekday(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TZ,
    weekday: "long",
  }).format(date);
}

/** HH:mm in IST for appointment boards */
export function formatIstTime(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** Inclusive IST calendar-day bounds as UTC Date objects. */
export function istDayBounds(dateKey: string): { start: Date; end: Date } {
  return {
    start: new Date(`${dateKey}T00:00:00+05:30`),
    end: new Date(`${dateKey}T23:59:59.999+05:30`),
  };
}

/** Add/subtract whole IST calendar days from a YYYY-MM-DD key. */
export function istAddCalendarDays(dateKey: string, days: number): string {
  const base = new Date(`${dateKey}T12:00:00+05:30`);
  base.setTime(base.getTime() + days * 24 * 60 * 60 * 1000);
  return istDateKey(base);
}

/** Parse a date or YYYY-MM-DD (IST calendar day → start of that day). */
export function parseIstDateInput(value: string | Date): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const s = value.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return istDayBounds(s).start;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
