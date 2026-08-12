import { prisma } from "@meiyon/db";
import { displayMobile, normalizeMobile } from "@/lib/auth/mobile";
import { userPhotoUrl } from "@/lib/auth/user-photo";
import { personDisplayName } from "@/shared/lib/person";
import { istDayBounds } from "@/lib/utils/ist";
import {
  derivePresenceStatus,
  type PresenceStatus,
} from "@/features/hrms/lib/status";
import type { BusyTodayBlock } from "@/features/availability/lib/busy-labels";
import { findOfficeHolidayForDate } from "@/features/hrms/server/office-holiday";

export type { PresenceStatus };

export type PresenceBusyBlock = BusyTodayBlock;

export type PresencePerson = {
  unitId: string;
  name: string | null;
  displayName: string;
  mobile: string;
  photoUrl?: string;
  designation: string | null;
  roles: string[];
  status: PresenceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  /** Attendance check-in note (board-only; does not block booking). */
  notes: string | null;
  leaveUnitId: string | null;
  /** Overlapping time-away blocks + scheduled appointments for this date. */
  busyToday: PresenceBusyBlock[];
};

export type PresenceCounts = {
  total: number;
  present: number;
  out: number;
  onLeave: number;
  absent: number;
};

export type PresenceBoard = {
  date: string;
  people: PresencePerson[];
  counts: PresenceCounts;
  /** When set, office is closed that day (festival / holiday). */
  officeHoliday: { unitId: string; title: string; notes: string | null } | null;
};

const STATUS_RANK: Record<PresenceStatus, number> = {
  absent: 0,
  on_leave: 1,
  out: 2,
  in: 3,
};

function mobileVariants(mobile: string): string[] {
  const n = normalizeMobile(mobile) ?? mobile.replace(/\D/g, "");
  const ten = n.startsWith("91") && n.length === 12 ? n.slice(2) : n;
  const with91 = ten.length === 10 ? `91${ten}` : n;
  return Array.from(new Set([n, ten, with91].filter(Boolean)));
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export async function buildPresenceBoard(dateKey: string): Promise<PresenceBoard> {
  const staff = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      unitId: true,
      name: true,
      mobile: true,
      photoKey: true,
      designation: true,
      roles: true,
    },
    orderBy: { name: "asc" },
  });

  const userIds = staff.map((s) => s.id);
  const unitIds = staff.map((s) => s.unitId);

  const { start: dayStart, end: dayEnd } = istDayBounds(dateKey);

  const advocateMobiles = Array.from(
    new Set(staff.flatMap((s) => mobileVariants(s.mobile)))
  );

  const [attendance, leaves, timeBlocks, appointments, holiday] = await Promise.all([
    userIds.length
      ? prisma.attendance.findMany({
          where: { date: dateKey, userId: { in: userIds } },
          select: {
            userId: true,
            checkInAt: true,
            checkOutAt: true,
            checkInLat: true,
            checkInLng: true,
            checkOutLat: true,
            checkOutLng: true,
            notes: true,
          },
        })
      : Promise.resolve([]),
    unitIds.length
      ? prisma.leaveRequest.findMany({
          where: {
            status: "approved",
            userUnitId: { in: unitIds },
            fromDate: { lte: dateKey },
            toDate: { gte: dateKey },
          },
          select: { unitId: true, userUnitId: true },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.advocateTimeBlock.findMany({
          where: {
            userId: { in: userIds },
            startsAt: { lt: dayEnd },
            endsAt: { gt: dayStart },
          },
          select: {
            userId: true,
            kind: true,
            startsAt: true,
            endsAt: true,
            reason: true,
          },
          orderBy: { startsAt: "asc" },
        })
      : Promise.resolve([]),
    advocateMobiles.length
      ? prisma.appointment.findMany({
          where: {
            status: "scheduled",
            advocateMobile: { in: advocateMobiles },
            scheduledAt: {
              gte: addMinutes(dayStart, -12 * 60),
              lt: dayEnd,
            },
          },
          select: {
            advocateMobile: true,
            title: true,
            scheduledAt: true,
            durationMin: true,
          },
          orderBy: { scheduledAt: "asc" },
        })
      : Promise.resolve([]),
    findOfficeHolidayForDate(dateKey),
  ]);

  const attByUser = new Map(attendance.map((a) => [a.userId, a]));
  const leaveByUnit = new Map(leaves.map((l) => [l.userUnitId, l.unitId]));
  const blocksByUser = new Map<string, PresenceBusyBlock[]>();
  for (const b of timeBlocks) {
    const list = blocksByUser.get(b.userId) ?? [];
    list.push({
      kind: b.kind,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      reason: b.reason,
    });
    blocksByUser.set(b.userId, list);
  }

  const userIdByMobile = new Map<string, string>();
  for (const s of staff) {
    for (const v of mobileVariants(s.mobile)) {
      userIdByMobile.set(v, s.id);
    }
  }

  for (const a of appointments) {
    if (!a.advocateMobile) continue;
    const userId = userIdByMobile.get(a.advocateMobile);
    if (!userId) continue;
    const start = a.scheduledAt;
    const end = addMinutes(a.scheduledAt, a.durationMin);
    // Only count appointments that overlap this IST calendar day.
    if (end.getTime() <= dayStart.getTime() || start.getTime() >= dayEnd.getTime()) {
      continue;
    }
    const list = blocksByUser.get(userId) ?? [];
    list.push({
      kind: "appointment",
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      reason: a.title,
    });
    blocksByUser.set(userId, list);
  }

  // Keep each person's busy list sorted by start.
  for (const [userId, list] of blocksByUser) {
    list.sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
    blocksByUser.set(userId, list);
  }

  const people: PresencePerson[] = staff.map((s) => {
    const mobile = displayMobile(s.mobile);
    const displayName = personDisplayName({
      name: s.name,
      mobile,
      unitId: s.unitId,
    });
    const leaveUnitId = leaveByUnit.get(s.unitId) ?? null;
    const att = attByUser.get(s.id);
    const status = derivePresenceStatus({
      onApprovedLeave: Boolean(leaveUnitId) || Boolean(holiday),
      checkInAt: att?.checkInAt,
      checkOutAt: att?.checkOutAt,
    });

    return {
      unitId: s.unitId,
      name: s.name,
      displayName,
      mobile,
      photoUrl: userPhotoUrl(s.unitId, Boolean(s.photoKey)),
      designation: s.designation,
      roles: s.roles,
      status,
      checkInAt: att?.checkInAt ? att.checkInAt.toISOString() : null,
      checkOutAt: att?.checkOutAt ? att.checkOutAt.toISOString() : null,
      checkInLat: att?.checkInLat ?? null,
      checkInLng: att?.checkInLng ?? null,
      checkOutLat: att?.checkOutLat ?? null,
      checkOutLng: att?.checkOutLng ?? null,
      notes: att?.notes ?? null,
      leaveUnitId,
      busyToday: blocksByUser.get(s.id) ?? [],
    };
  });

  people.sort((a, b) => {
    const r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (r !== 0) return r;
    return a.displayName.localeCompare(b.displayName);
  });

  const counts: PresenceCounts = {
    total: people.length,
    present: people.filter((p) => p.status === "in").length,
    out: people.filter((p) => p.status === "out").length,
    onLeave: people.filter((p) => p.status === "on_leave").length,
    absent: people.filter((p) => p.status === "absent").length,
  };

  return {
    date: dateKey,
    people,
    counts,
    officeHoliday: holiday
      ? {
          unitId: holiday.unitId,
          title: holiday.title,
          notes: holiday.notes ?? null,
        }
      : null,
  };
}
