import { prisma } from "@meiyon/db";
import { normalizeMobile } from "@/lib/auth/mobile";
import {
  canActAsHearingAdvocate,
  clashMessage,
  findCrossCourtClash,
  mobileLookupVariants,
  type ClashReason,
  type ClashResult,
} from "@/lib/hearings/advocate-day";
import { courtKey } from "@/lib/hearings/court-key";
import { istDayBounds } from "@/lib/utils/ist";

type Court = {
  state?: string | null;
  district?: string | null;
  city?: string | null;
  courtName?: string | null;
};

type AdvocateRow = {
  id: string;
  unitId: string;
  mobile: string;
  isActive?: boolean;
  roles?: string[];
};

export type BatchAvailabilityRow = {
  available: boolean;
  day?: string;
  reason?: ClashReason;
  detail?: string;
  message?: string;
};

/**
 * Batch availability for many advocates across a date range (few DB round-trips).
 * Same rules as assertAdvocateCourtDayAvailable, without N×M queries.
 */
export async function batchAdvocateCourtAvailability(input: {
  advocates: AdvocateRow[];
  days: string[];
  court: Court;
}): Promise<Map<string, BatchAvailabilityRow>> {
  const out = new Map<string, BatchAvailabilityRow>();

  if (input.advocates.length === 0 || input.days.length === 0) {
    return out;
  }

  const fromDate = input.days[0]!;
  const toDate = input.days[input.days.length - 1]!;
  const rangeStart = istDayBounds(fromDate).start;
  const rangeEnd = istDayBounds(toDate).end;
  const userIds = input.advocates.map((a) => a.id);
  const targetKey = courtKey(input.court);

  const allMobileVariants = [
    ...new Set(
      input.advocates.flatMap((a) => {
        const m = normalizeMobile(a.mobile);
        return m ? mobileLookupVariants(m) : [];
      })
    ),
  ];

  const [leaves, blocks, appointments, hearings] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        userId: { in: userIds },
        status: "approved",
        fromDate: { lte: toDate },
        toDate: { gte: fromDate },
      },
      select: { userId: true, fromDate: true, toDate: true },
    }),
    prisma.advocateTimeBlock.findMany({
      where: {
        userId: { in: userIds },
        kind: { in: ["court", "personal", "other"] },
        startsAt: { lt: rangeEnd },
        endsAt: { gt: rangeStart },
      },
      select: { userId: true, kind: true, startsAt: true, endsAt: true },
    }),
    allMobileVariants.length
      ? prisma.appointment.findMany({
          where: {
            advocateMobile: { in: allMobileVariants },
            status: { not: "cancelled" },
            scheduledAt: { gte: rangeStart, lte: rangeEnd },
          },
          select: { advocateMobile: true, scheduledAt: true },
        })
      : Promise.resolve([]),
    prisma.hearing.findMany({
      where: {
        isAdjourned: false,
        hearingDate: { gte: rangeStart, lte: rangeEnd },
      },
      select: { caseUnitId: true, hearingDate: true },
    }),
  ]);

  const caseUnitIds = [...new Set(hearings.map((h) => h.caseUnitId))];
  const cases =
    caseUnitIds.length > 0
      ? await prisma.case.findMany({
          where: { unitId: { in: caseUnitIds } },
          select: {
            unitId: true,
            primaryAdvocateMobile: true,
            state: true,
            district: true,
            city: true,
            courtName: true,
          },
        })
      : [];
  const casesByUnit = new Map(cases.map((c) => [c.unitId, c]));

  const leaveByUser = new Map<string, Array<{ fromDate: string; toDate: string }>>();
  for (const l of leaves) {
    const list = leaveByUser.get(l.userId) ?? [];
    list.push({ fromDate: l.fromDate, toDate: l.toDate });
    leaveByUser.set(l.userId, list);
  }

  const blocksByUser = new Map<
    string,
    Array<{ kind: string; startsAt: Date; endsAt: Date }>
  >();
  for (const b of blocks) {
    const list = blocksByUser.get(b.userId) ?? [];
    list.push(b);
    blocksByUser.set(b.userId, list);
  }

  const apptByMobile91 = new Map<string, Date[]>();
  for (const a of appointments) {
    if (!a.advocateMobile) continue;
    const m = normalizeMobile(a.advocateMobile);
    if (!m) continue;
    const list = apptByMobile91.get(m) ?? [];
    list.push(a.scheduledAt);
    apptByMobile91.set(m, list);
  }

  const hearingsByIstDay = new Map<string, Array<{ caseUnitId: string }>>();
  for (const day of input.days) {
    const { start, end } = istDayBounds(day);
    const list: Array<{ caseUnitId: string }> = [];
    for (const h of hearings) {
      if (h.hearingDate >= start && h.hearingDate <= end) {
        list.push({ caseUnitId: h.caseUnitId });
      }
    }
    hearingsByIstDay.set(day, list);
  }

  for (const adv of input.advocates) {
    const mobile91 = normalizeMobile(adv.mobile);
    let blocked: {
      day?: string;
      reason: ClashReason;
      detail?: string;
      message: string;
    } | null = null;

    if (!mobile91) {
      blocked = {
        reason: "inactive",
        message: clashMessage({
          ok: false,
          reason: "inactive",
          detail: "Invalid mobile",
        }),
        detail: "Invalid mobile",
      };
    } else if (adv.isActive === false) {
      blocked = {
        reason: "inactive",
        message: clashMessage({ ok: false, reason: "inactive" }),
      };
    } else if (adv.roles && !canActAsHearingAdvocate(adv.roles)) {
      blocked = {
        reason: "not_advocate",
        message: clashMessage({ ok: false, reason: "not_advocate" }),
      };
    } else {
      for (const day of input.days) {
        const { start: dayStart, end: dayEnd } = istDayBounds(day);

        const onLeave = (leaveByUser.get(adv.id) ?? []).some(
          (l) => l.fromDate <= day && l.toDate >= day
        );
        if (onLeave) {
          blocked = {
            day,
            reason: "on_leave",
            message: clashMessage({ ok: false, reason: "on_leave" }),
          };
          break;
        }

        const block = (blocksByUser.get(adv.id) ?? []).find(
          (b) => b.startsAt < dayEnd && b.endsAt > dayStart
        );
        if (block) {
          blocked = {
            day,
            reason: "time_block",
            detail: block.kind,
            message: clashMessage({
              ok: false,
              reason: "time_block",
              detail: block.kind,
            }),
          };
          break;
        }

        const hasAppt = (apptByMobile91.get(mobile91) ?? []).some(
          (t) => t >= dayStart && t <= dayEnd
        );
        if (hasAppt) {
          blocked = {
            day,
            reason: "appointment",
            message: clashMessage({ ok: false, reason: "appointment" }),
          };
          break;
        }

        const dayHearings = hearingsByIstDay.get(day) ?? [];
        const clash: ClashResult = findCrossCourtClash({
          advocateMobile91: mobile91,
          targetCourtKey: targetKey,
          hearings: dayHearings,
          casesByUnit: casesByUnit,
        });
        if (!clash.ok) {
          blocked = {
            day,
            reason: clash.reason,
            detail: clash.detail,
            message: clashMessage(clash),
          };
          break;
        }
      }
    }

    out.set(adv.unitId, {
      available: !blocked,
      ...(blocked
        ? {
            day: blocked.day,
            reason: blocked.reason,
            detail: blocked.detail,
            message: blocked.message,
          }
        : {}),
    });
  }

  return out;
}
