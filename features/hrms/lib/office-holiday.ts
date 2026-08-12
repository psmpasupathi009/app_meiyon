import { leaveCoversDate } from "@/features/hrms/lib/status";

export type OfficeHolidaySummary = {
  unitId: string;
  fromDate: string;
  toDate: string;
  title: string;
  notes: string | null;
  createdAt: string;
};

export function toOfficeHolidaySummary(row: {
  unitId: string;
  fromDate: string;
  toDate: string;
  title: string;
  notes: string | null;
  createdAt: Date;
}): OfficeHolidaySummary {
  return {
    unitId: row.unitId,
    fromDate: row.fromDate,
    toDate: row.toDate,
    title: row.title,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

/** True if dateKey (YYYY-MM-DD) falls in any of the given holidays. */
export function dateIsOfficeHoliday(
  dateKey: string,
  holidays: { fromDate: string; toDate: string }[]
): boolean {
  return holidays.some((h) => leaveCoversDate(h.fromDate, h.toDate, dateKey));
}
