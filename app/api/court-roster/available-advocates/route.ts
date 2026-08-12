import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { displayMobile } from "@/lib/auth/mobile";
import { personDisplayName } from "@/shared/lib/person";
import { istDateKey } from "@/lib/utils/ist";
import type { ClashReason } from "@/lib/hearings/advocate-day";
import {
  eachIstDateInclusive,
  findAdvocateDutyClash,
  findOverlappingOverride,
} from "@/features/court-roster/lib/effective-cover";
import { batchAdvocateCourtAvailability } from "@/features/court-roster/lib/batch-availability";
import { parseDefaultCourts } from "@/lib/hearings/court-key";

type BlockReason = ClashReason | "duty_override" | "court_covered";

/**
 * List advocates and whether they are free for a court across a date range.
 * Query: fromDate, toDate (or date), state, district, city, courtName
 */
export const GET = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "employees", "view");
  if (!user) return response;

  const { searchParams } = new URL(request.url);
  const fromDate =
    searchParams.get("fromDate")?.trim() ||
    searchParams.get("date")?.trim() ||
    istDateKey();
  const toDate = searchParams.get("toDate")?.trim() || fromDate;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    return jsonFail("VALIDATION", "Use YYYY-MM-DD dates", 400);
  }
  if (fromDate > toDate) {
    return jsonFail("VALIDATION", "End date must be on or after start date", 400);
  }

  const court = {
    state: searchParams.get("state")?.trim() ?? "",
    district: searchParams.get("district")?.trim() ?? "",
    city: searchParams.get("city")?.trim() ?? "",
    courtName: searchParams.get("courtName")?.trim() ?? "",
  };
  if (!court.state || !court.district || !court.city || !court.courtName) {
    return jsonFail("VALIDATION", "Court state, district, city, and name are required", 400);
  }

  const days = eachIstDateInclusive(fromDate, toDate);
  if (days.length > 62) {
    return jsonFail("VALIDATION", "Date range can be at most 62 days", 400);
  }

  const [advocates, overlappingOverrides] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, roles: { has: "advocate" } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        unitId: true,
        name: true,
        mobile: true,
        designation: true,
        photoKey: true,
        defaultCourts: true,
        isActive: true,
        roles: true,
      },
    }),
    prisma.courtDutyOverride.findMany({
      where: {
        toDate: { gte: fromDate },
        fromDate: { lte: toDate },
      },
      select: {
        unitId: true,
        state: true,
        district: true,
        city: true,
        courtName: true,
        fromDate: true,
        toDate: true,
        advocateUnitId: true,
      },
    }),
  ]);

  const courtAlreadyCovered = findOverlappingOverride(overlappingOverrides, {
    ...court,
    fromDate,
    toDate,
  });

  const dayAvailability = courtAlreadyCovered
    ? null
    : await batchAdvocateCourtAvailability({
        advocates,
        days,
        court,
      });

  const results: Array<{
    unitId: string;
    name: string | null;
    displayName: string;
    mobile: string;
    designation: string | null;
    defaultCourts: ReturnType<typeof parseDefaultCourts>;
    available: boolean;
    blockedOn?: string;
    reason?: BlockReason;
    detail?: string;
    message?: string;
  }> = [];

  for (const adv of advocates) {
    const mobile = displayMobile(adv.mobile);
    let blocked: {
      day?: string;
      reason: BlockReason;
      detail?: string;
      message: string;
    } | null = null;

    if (courtAlreadyCovered) {
      blocked = {
        reason: "court_covered",
        detail: courtAlreadyCovered.unitId,
        message: `This court already has temporary cover (${courtAlreadyCovered.unitId})`,
      };
    } else {
      const dutyClash = findAdvocateDutyClash(overlappingOverrides, {
        ...court,
        fromDate,
        toDate,
        advocateUnitId: adv.unitId,
      });
      if (dutyClash) {
        blocked = {
          reason: "duty_override",
          detail: dutyClash.courtName,
          message: `Already temporary cover at ${dutyClash.courtName}`,
        };
      } else {
        const dayHit = dayAvailability?.get(adv.unitId);
        if (dayHit && !dayHit.available) {
          blocked = {
            day: dayHit.day,
            reason: (dayHit.reason ?? "inactive") as BlockReason,
            detail: dayHit.detail,
            message: dayHit.message ?? "Advocate not available",
          };
        }
      }
    }

    results.push({
      unitId: adv.unitId,
      name: adv.name,
      displayName: personDisplayName({
        name: adv.name,
        mobile,
        unitId: adv.unitId,
      }),
      mobile,
      designation: adv.designation,
      defaultCourts: parseDefaultCourts(adv.defaultCourts),
      available: !blocked,
      ...(blocked
        ? {
            blockedOn: blocked.day,
            reason: blocked.reason,
            detail: blocked.detail,
            message: blocked.message,
          }
        : {}),
    });
  }

  const available = results.filter((r) => r.available);
  const unavailable = results.filter((r) => !r.available);

  return jsonOk({
    fromDate,
    toDate,
    court,
    courtCoveredBy: courtAlreadyCovered?.unitId ?? null,
    available,
    unavailable,
    advocates: results,
  });
});
