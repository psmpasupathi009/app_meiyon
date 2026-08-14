import { prisma } from "@meiyon/db";
import { displayMobile, normalizeMobile } from "@/lib/auth/mobile";
import { isOnApprovedLeave } from "@/lib/appointments/availability";
import {
  courtKey,
  effectiveHearingAdvocate,
} from "@/lib/hearings/court-key";
import { istDateKey, istDayBounds } from "@/lib/utils/ist";

/** Principal office admins are listed on cases as the advocate. */
export function canActAsHearingAdvocate(
  roles: string[] | null | undefined
): boolean {
  if (!roles?.length) return false;
  return (
    roles.includes("advocate") ||
    roles.includes("admin") ||
    roles.includes("sub_admin")
  );
}

export type ClashReason =
  | "inactive"
  | "not_advocate"
  | "on_leave"
  | "time_block"
  | "other_court"
  | "appointment";

export type ClashResult =
  | { ok: true }
  | { ok: false; reason: ClashReason; detail?: string };

/** Mobile variants as stored on Case / Appointment / Hearing fields. */
export function mobileLookupVariants(mobile91: string): string[] {
  const ten = displayMobile(mobile91);
  return [...new Set([mobile91, ten, `+${mobile91}`, `+91${ten}`])];
}

/** Pure cross-court check used by assertAdvocateCourtDayAvailable + unit tests. */
export function findCrossCourtClash(input: {
  advocateMobile91: string;
  targetCourtKey: string;
  hearings: Array<{
    caseUnitId: string;
  }>;
  casesByUnit: Map<
    string,
    {
      primaryAdvocateMobile?: string | null;
      state?: string | null;
      district?: string | null;
      city?: string | null;
      courtName?: string | null;
    }
  >;
}): ClashResult {
  const mobile = input.advocateMobile91;
  for (const h of input.hearings) {
    const cse = input.casesByUnit.get(h.caseUnitId);
    if (!cse) continue;
    const effective = effectiveHearingAdvocate({
      primaryAdvocateMobile: cse.primaryAdvocateMobile,
    });
    if (!effective || normalizeMobile(effective) !== mobile) continue;
    const key = courtKey(cse);
    if (key && input.targetCourtKey && key !== input.targetCourtKey) {
      return {
        ok: false,
        reason: "other_court",
        detail: cse.courtName ?? key,
      };
    }
  }
  return { ok: true };
}

/**
 * One advocate may have many hearings at the SAME court on a day.
 * Reject leave, blocks, appointments, or hearings at a DIFFERENT court.
 */
export async function assertAdvocateCourtDayAvailable(input: {
  officeId: string;
  advocateMobile: string;
  hearingDate: Date;
  court: {
    state?: string | null;
    district?: string | null;
    city?: string | null;
    courtName?: string | null;
  };
  excludeHearingId?: string;
}): Promise<ClashResult> {
  const mobile = normalizeMobile(input.advocateMobile);
  if (!mobile) {
    return { ok: false, reason: "inactive", detail: "Invalid mobile" };
  }

  const user = await prisma.user.findFirst({
    where: { mobile, officeId: input.officeId },
  });
  if (!user || !user.isActive) {
    return { ok: false, reason: "inactive" };
  }
  if (!canActAsHearingAdvocate(user.roles)) {
    return { ok: false, reason: "not_advocate" };
  }

  const ymd = istDateKey(input.hearingDate);
  if (await isOnApprovedLeave(user.id, ymd)) {
    return { ok: false, reason: "on_leave" };
  }

  const { start: dayStart, end: dayEnd } = istDayBounds(ymd);

  const block = await prisma.advocateTimeBlock.findFirst({
    where: {
      userId: user.id,
      kind: { in: ["court", "personal", "other"] },
      startsAt: { lt: dayEnd },
      endsAt: { gt: dayStart },
    },
  });
  if (block) {
    return { ok: false, reason: "time_block", detail: block.kind };
  }

  const mobiles = mobileLookupVariants(mobile);
  const appointment = await prisma.appointment.findFirst({
    where: {
      advocateMobile: { in: mobiles },
      status: { not: "cancelled" },
      scheduledAt: { gte: dayStart, lte: dayEnd },
    },
  });
  if (appointment) {
    return { ok: false, reason: "appointment" };
  }

  const targetKey = courtKey(input.court);
  const hearings = await prisma.hearing.findMany({
    where: {
      isAdjourned: false,
      hearingDate: { gte: dayStart, lte: dayEnd },
      ...(input.excludeHearingId
        ? { id: { not: input.excludeHearingId } }
        : {}),
    },
    select: {
      id: true,
      caseUnitId: true,
    },
  });

  if (hearings.length === 0) return { ok: true };

  const caseUnitIds = [...new Set(hearings.map((h) => h.caseUnitId))];
  const cases = await prisma.case.findMany({
    where: { unitId: { in: caseUnitIds } },
    select: {
      unitId: true,
      primaryAdvocateMobile: true,
      state: true,
      district: true,
      city: true,
      courtName: true,
    },
  });
  const caseByUnit = new Map(cases.map((c) => [c.unitId, c]));

  return findCrossCourtClash({
    advocateMobile91: mobile,
    targetCourtKey: targetKey,
    hearings,
    casesByUnit: caseByUnit,
  });
}

export function clashMessage(result: ClashResult): string {
  if (result.ok) return "";
  switch (result.reason) {
    case "inactive":
      return "Advocate is inactive or not found";
    case "not_advocate":
      return "User is not an advocate";
    case "on_leave":
      return "Advocate is on approved leave that day";
    case "time_block":
      return "Advocate has an unavailable time block that day";
    case "appointment":
      return "Advocate already has an appointment that day";
    case "other_court":
      return `Advocate already listed at another court that day${
        result.detail ? ` (${result.detail})` : ""
      }`;
    default:
      return "Advocate not available that day";
  }
}
