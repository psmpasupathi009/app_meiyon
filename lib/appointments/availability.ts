import { bookingDefaults } from "@/config/company/booking";
import { prisma } from "@meiyon/db";
import { normalizeMobile } from "@/lib/auth/mobile";
import { istDateKey, istDayBounds } from "@/lib/utils/ist";
import { busySegmentLabel } from "@/features/availability/lib/busy-labels";
import { findOfficeHolidayForDate } from "@/features/hrms/server/office-holiday";

export type ConflictCode =
  | "ADVOCATE_BUSY"
  | "CLIENT_BUSY"
  | "OUTSIDE_HOURS"
  | "BLOCKED"
  | "ON_LEAVE"
  | "OFFICE_CLOSED"
  | "IN_PAST"
  | "NO_ADVOCATE";

export type ConflictResult = {
  ok: false;
  code: ConflictCode;
  message: string;
};

export type BookableOk = { ok: true };

export type Interval = { start: Date; end: Date };

export type BusyReason = "appointment" | "block" | "leave" | "closed";

export type BusySegment = {
  start: string;
  end: string;
  reason: BusyReason;
  label?: string;
};

/** Full-day closed payload when an office holiday covers the date. */
export function buildOfficeClosedDayAvailability(input: {
  dateKey: string;
  advocateMobile: string;
  durationMin: number;
  holidayTitle: string;
  dayStart: Date;
  dayEnd: Date;
}): DayAvailability {
  return {
    date: input.dateKey,
    advocateMobile: input.advocateMobile,
    durationMin: input.durationMin,
    onLeave: false,
    windows: [],
    freeSlots: [],
    busy: [
      {
        start: input.dayStart.toISOString(),
        end: input.dayEnd.toISOString(),
        reason: "closed",
        label: `Office closed — ${input.holidayTitle}`,
      },
    ],
  };
}

export type DayAvailability = {
  date: string;
  advocateMobile: string;
  durationMin: number;
  onLeave: boolean;
  windows: { start: string; end: string }[];
  freeSlots: string[];
  busy: BusySegment[];
};

const CONFLICT_MESSAGES: Record<ConflictCode, string> = {
  ADVOCATE_BUSY: "This advocate already has an appointment at that time",
  CLIENT_BUSY: "This client already has an appointment at that time",
  OUTSIDE_HOURS: "That time is outside the advocate’s working hours",
  BLOCKED: "That time is blocked on the advocate’s diary (court, travel, or break)",
  ON_LEAVE: "The advocate is on approved leave that day",
  OFFICE_CLOSED: "Office is closed that day (holiday)",
  IN_PAST: "Cannot book a time in the past",
  NO_ADVOCATE: "Advocate not found",
};

export function conflictFail(code: ConflictCode, message?: string): ConflictResult {
  return { ok: false, code, message: message ?? CONFLICT_MESSAGES[code] };
}

/** Half-open interval overlap: [aStart, aEnd) vs [bStart, bEnd). */
export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Parse HH:mm to minutes from midnight. */
export function timeToMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** HH:mm in IST for a Date. */
export function formatIstHm(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  // en-GB may yield "24" for midnight — normalize
  const h = hour === "24" ? "00" : hour;
  return `${h.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

/** IST weekday 0=Sun…6=Sat for a YYYY-MM-DD key. */
export function istWeekday(dateKey: string): number {
  const { start } = istDayBounds(dateKey);
  // en-US with Asia/Kolkata gives correct weekday
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
  }).format(start);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[label] ?? start.getUTCDay();
}

export function istDateTime(dateKey: string, hhmm: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  if (timeToMinutes(hhmm) == null) return null;
  const d = new Date(`${dateKey}T${hhmm}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mobileVariants(mobile: string): string[] {
  const n = normalizeMobile(mobile) ?? mobile;
  const ten = n.replace(/\D/g, "").slice(-10);
  return Array.from(new Set([n, ten, `91${ten}`, mobile]));
}

export async function findAdvocateByMobile(mobile: string) {
  const variants = mobileVariants(mobile);
  return prisma.user.findFirst({
    where: {
      isActive: true,
      roles: { has: "advocate" },
      OR: variants.map((m) => ({ mobile: m })),
    },
    select: { id: true, unitId: true, mobile: true, name: true },
  });
}

type HourRow = { weekday: number; startTime: string; endTime: string };

/** Marker row: hours were saved but every day is closed (no open windows). */
export const CLOSED_WEEK_SENTINEL: HourRow = {
  weekday: 0,
  startTime: "00:00",
  endTime: "00:00",
};

function isClosedSentinel(row: HourRow): boolean {
  return (
    row.startTime === CLOSED_WEEK_SENTINEL.startTime &&
    row.endTime === CLOSED_WEEK_SENTINEL.endTime
  );
}

export async function loadWeeklyHours(userId: string): Promise<{
  rows: HourRow[];
  usingDefaults: boolean;
}> {
  const rows = await prisma.advocateWeeklyHours.findMany({
    where: { userId },
    select: { weekday: true, startTime: true, endTime: true },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });
  if (rows.length === 0) {
    return {
      rows: bookingDefaults.weeklyHours.map((r) => ({ ...r })),
      usingDefaults: true,
    };
  }
  // Keep sentinel out of window math; empty list = closed week, not defaults.
  return {
    rows: rows.filter((r) => !isClosedSentinel(r)),
    usingDefaults: false,
  };
}

function windowsForDay(rows: HourRow[], weekday: number): { start: string; end: string }[] {
  return rows
    .filter((r) => r.weekday === weekday)
    .map((r) => ({ start: r.startTime, end: r.endTime }))
    .filter((w) => {
      const a = timeToMinutes(w.start);
      const b = timeToMinutes(w.end);
      return a != null && b != null && b > a;
    });
}

function slotFullyInsideWindows(
  startMin: number,
  endMin: number,
  windows: { start: string; end: string }[]
): boolean {
  return windows.some((w) => {
    const a = timeToMinutes(w.start)!;
    const b = timeToMinutes(w.end)!;
    return startMin >= a && endMin <= b;
  });
}

export async function isOnApprovedLeave(
  userId: string,
  dateKey: string
): Promise<boolean> {
  const leave = await prisma.leaveRequest.findFirst({
    where: {
      userId,
      status: "approved",
      fromDate: { lte: dateKey },
      toDate: { gte: dateKey },
    },
    select: { id: true },
  });
  return Boolean(leave);
}

export type AssertSlotInput = {
  advocateMobile: string;
  clientUnitId?: string | null;
  start: Date;
  durationMin: number;
  /** Exclude this appointment unitId when editing */
  excludeAppointmentUnitId?: string;
};

export async function assertSlotBookable(
  input: AssertSlotInput
): Promise<BookableOk | ConflictResult> {
  const durationMin = Math.max(1, input.durationMin || 30);
  const end = addMinutes(input.start, durationMin);
  const now = new Date();
  if (input.start.getTime() < now.getTime() - 60_000) {
    return conflictFail("IN_PAST");
  }

  const advocate = await findAdvocateByMobile(input.advocateMobile);
  if (!advocate) return conflictFail("NO_ADVOCATE");

  const dateKey = istDateKey(input.start);
  const holiday = await findOfficeHolidayForDate(dateKey);
  if (holiday) {
    return conflictFail(
      "OFFICE_CLOSED",
      `Office closed — ${holiday.title}`
    );
  }
  if (await isOnApprovedLeave(advocate.id, dateKey)) {
    return conflictFail("ON_LEAVE");
  }

  const { rows: hours } = await loadWeeklyHours(advocate.id);
  const weekday = istWeekday(dateKey);
  const windows = windowsForDay(hours, weekday);
  const startHm = formatIstHm(input.start);
  const startMin = timeToMinutes(startHm);
  const endMin = startMin != null ? startMin + durationMin : null;
  if (startMin == null || endMin == null || !slotFullyInsideWindows(startMin, endMin, windows)) {
    return conflictFail("OUTSIDE_HOURS");
  }

  const block = await prisma.advocateTimeBlock.findFirst({
    where: {
      userId: advocate.id,
      startsAt: { lt: end },
      endsAt: { gt: input.start },
    },
    select: { id: true, kind: true },
  });
  if (block) {
    return conflictFail(
      "BLOCKED",
      block.kind === "court"
        ? "Advocate is in court at that time"
        : "That time is blocked on the advocate’s diary"
    );
  }

  const mobileOr = mobileVariants(advocate.mobile).map((m) => ({
    advocateMobile: m,
  }));

  // Look back far enough that long appointments can still overlap this slot.
  const lookbackStart = addMinutes(input.start, -12 * 60);
  const dayAppts = await prisma.appointment.findMany({
    where: {
      status: "scheduled",
      OR: mobileOr,
      scheduledAt: { gte: lookbackStart, lt: end },
      ...(input.excludeAppointmentUnitId
        ? { NOT: { unitId: input.excludeAppointmentUnitId } }
        : {}),
    },
    select: { scheduledAt: true, durationMin: true },
  });
  for (const a of dayAppts) {
    const aEnd = addMinutes(a.scheduledAt, a.durationMin);
    if (intervalsOverlap(input.start, end, a.scheduledAt, aEnd)) {
      return conflictFail("ADVOCATE_BUSY");
    }
  }

  if (input.clientUnitId) {
    const clientAppts = await prisma.appointment.findMany({
      where: {
        status: "scheduled",
        clientUnitId: input.clientUnitId,
        scheduledAt: { gte: lookbackStart, lt: end },
        ...(input.excludeAppointmentUnitId
          ? { NOT: { unitId: input.excludeAppointmentUnitId } }
          : {}),
      },
      select: { scheduledAt: true, durationMin: true },
    });
    for (const a of clientAppts) {
      const aEnd = addMinutes(a.scheduledAt, a.durationMin);
      if (intervalsOverlap(input.start, end, a.scheduledAt, aEnd)) {
        return conflictFail("CLIENT_BUSY");
      }
    }
  }

  return { ok: true };
}

export type GetDayAvailabilityInput = {
  advocateMobile: string;
  dateKey: string;
  durationMin: number;
  clientUnitId?: string | null;
  excludeAppointmentUnitId?: string;
};

export async function getDayAvailability(
  input: GetDayAvailabilityInput
): Promise<DayAvailability | ConflictResult> {
  const durationMin = Math.max(1, input.durationMin || 30);
  const advocate = await findAdvocateByMobile(input.advocateMobile);
  if (!advocate) return conflictFail("NO_ADVOCATE");

  const onLeave = await isOnApprovedLeave(advocate.id, input.dateKey);
  const holiday = await findOfficeHolidayForDate(input.dateKey);
  const { rows: hours } = await loadWeeklyHours(advocate.id);
  const weekday = istWeekday(input.dateKey);
  const windows = windowsForDay(hours, weekday);
  const { start: dayStart, end: dayEnd } = istDayBounds(input.dateKey);

  const busy: BusySegment[] = [];
  if (holiday) {
    return buildOfficeClosedDayAvailability({
      dateKey: input.dateKey,
      advocateMobile: advocate.mobile,
      durationMin,
      holidayTitle: holiday.title,
      dayStart,
      dayEnd,
    });
  }
  if (onLeave) {
    busy.push({
      start: dayStart.toISOString(),
      end: dayEnd.toISOString(),
      reason: "leave",
      label: "Approved leave",
    });
    return {
      date: input.dateKey,
      advocateMobile: advocate.mobile,
      durationMin,
      onLeave: true,
      windows: [],
      freeSlots: [],
      busy,
    };
  }

  if (windows.length === 0) {
    busy.push({
      start: dayStart.toISOString(),
      end: dayEnd.toISOString(),
      reason: "closed",
      label: "Not working this day",
    });
  }

  const mobileOr = mobileVariants(advocate.mobile).map((m) => ({
    advocateMobile: m,
  }));

  const [appts, blocks] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        status: "scheduled",
        OR: mobileOr,
        // Include previous-day starts that may spill into this IST day.
        scheduledAt: {
          gte: addMinutes(dayStart, -12 * 60),
          lte: dayEnd,
        },
        ...(input.excludeAppointmentUnitId
          ? { NOT: { unitId: input.excludeAppointmentUnitId } }
          : {}),
      },
      select: { scheduledAt: true, durationMin: true, title: true },
    }),
    prisma.advocateTimeBlock.findMany({
      where: {
        userId: advocate.id,
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      select: { startsAt: true, endsAt: true, kind: true, reason: true },
    }),
  ]);

  for (const a of appts) {
    const aEnd = addMinutes(a.scheduledAt, a.durationMin);
    if (!intervalsOverlap(dayStart, dayEnd, a.scheduledAt, aEnd)) continue;
    busy.push({
      start: a.scheduledAt.toISOString(),
      end: aEnd.toISOString(),
      reason: "appointment",
      label: busySegmentLabel({
        reason: "appointment",
        label: a.title,
      }),
    });
  }
  for (const b of blocks) {
    busy.push({
      start: b.startsAt.toISOString(),
      end: b.endsAt.toISOString(),
      reason: "block",
      label: busySegmentLabel({
        reason: "block",
        label: b.reason,
        kind: b.kind,
      }),
    });
  }

  let clientBusy: { scheduledAt: Date; durationMin: number }[] = [];
  if (input.clientUnitId) {
    const rawClient = await prisma.appointment.findMany({
      where: {
        status: "scheduled",
        clientUnitId: input.clientUnitId,
        scheduledAt: {
          gte: addMinutes(dayStart, -12 * 60),
          lte: dayEnd,
        },
        ...(input.excludeAppointmentUnitId
          ? { NOT: { unitId: input.excludeAppointmentUnitId } }
          : {}),
      },
      select: { scheduledAt: true, durationMin: true },
    });
    clientBusy = rawClient.filter((a) =>
      intervalsOverlap(
        dayStart,
        dayEnd,
        a.scheduledAt,
        addMinutes(a.scheduledAt, a.durationMin)
      )
    );
  }

  const step = bookingDefaults.slotStepMin;
  const freeSlots: string[] = [];
  const now = Date.now();

  for (const w of windows) {
    const wStart = timeToMinutes(w.start)!;
    const wEnd = timeToMinutes(w.end)!;
    for (let t = wStart; t + durationMin <= wEnd; t += step) {
      const hhmm = minutesToTime(t);
      const start = istDateTime(input.dateKey, hhmm);
      if (!start) continue;
      if (start.getTime() < now - 60_000) continue;
      const end = addMinutes(start, durationMin);

      let clash = false;
      for (const a of appts) {
        if (intervalsOverlap(start, end, a.scheduledAt, addMinutes(a.scheduledAt, a.durationMin))) {
          clash = true;
          break;
        }
      }
      if (clash) continue;
      for (const b of blocks) {
        if (intervalsOverlap(start, end, b.startsAt, b.endsAt)) {
          clash = true;
          break;
        }
      }
      if (clash) continue;
      for (const c of clientBusy) {
        if (intervalsOverlap(start, end, c.scheduledAt, addMinutes(c.scheduledAt, c.durationMin))) {
          clash = true;
          break;
        }
      }
      if (clash) continue;
      freeSlots.push(hhmm);
    }
  }

  return {
    date: input.dateKey,
    advocateMobile: advocate.mobile,
    durationMin,
    onLeave: false,
    windows,
    freeSlots,
    busy,
  };
}
