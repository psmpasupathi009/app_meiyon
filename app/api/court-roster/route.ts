import { apiHandler, jsonFail, jsonOk } from "@/lib/api/response";
import { requirePerm } from "@/lib/api/guard";
import { prisma } from "@meiyon/db";
import { displayMobile } from "@/lib/auth/mobile";
import { personDisplayName } from "@/shared/lib/person";
import { istDateKey } from "@/lib/utils/ist";
import {
  buildCourtRosterForDate,
  parseAdvocateDefaults,
  type CourtDutyOverrideLike,
} from "@/features/court-roster/lib/effective-cover";

function serializeOverride(
  row: {
    unitId: string;
    state: string;
    district: string;
    city: string;
    courtName: string;
    advocateUserId: string;
    advocateUnitId: string;
    advocateMobile: string;
    fromDate: string;
    toDate: string;
    reason: string | null;
  },
  advocate?: { name: string | null; unitId: string; mobile: string } | null
): CourtDutyOverrideLike {
  const mobile = displayMobile(row.advocateMobile);
  const name = advocate?.name ?? null;
  return {
    unitId: row.unitId,
    state: row.state,
    district: row.district,
    city: row.city,
    courtName: row.courtName,
    advocateUserId: row.advocateUserId,
    advocateUnitId: row.advocateUnitId,
    advocateMobile: mobile,
    fromDate: row.fromDate,
    toDate: row.toDate,
    reason: row.reason,
    advocateName: name,
    advocateDisplayName: personDisplayName({
      name,
      mobile,
      unitId: row.advocateUnitId,
    }),
  };
}

export const GET = apiHandler(async (request) => {
  const { user, response } = await requirePerm(request, "employees", "view");
  if (!user) return response;

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date")?.trim();
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : istDateKey();

  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

  const [advocates, overrides] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, roles: { has: "advocate" } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        unitId: true,
        name: true,
        mobile: true,
        defaultCourts: true,
      },
    }),
    prisma.courtDutyOverride.findMany({
      where: {
        // Include any that might be active on this date or nearby for the active list
        toDate: { gte: date },
      },
      orderBy: { fromDate: "asc" },
    }),
  ]);

  const advocateById = new Map(advocates.map((a) => [a.id, a]));
  const advocateByUnit = new Map(advocates.map((a) => [a.unitId, a]));

  // Load names for override advocates not in active list (edge)
  const missingUnitIds = [
    ...new Set(
      overrides
        .map((o) => o.advocateUnitId)
        .filter((id) => !advocateByUnit.has(id))
    ),
  ];
  if (missingUnitIds.length > 0) {
    const extras = await prisma.user.findMany({
      where: { unitId: { in: missingUnitIds } },
      select: { id: true, unitId: true, name: true, mobile: true },
    });
    for (const e of extras) advocateByUnit.set(e.unitId, { ...e, defaultCourts: [] });
  }

  const overrideLikes = overrides.map((o) => {
    const adv =
      advocateById.get(o.advocateUserId) ??
      advocateByUnit.get(o.advocateUnitId) ??
      null;
    return serializeOverride(o, adv);
  });

  const activeOnDate = overrideLikes.filter(
    (o) => o.fromDate <= date && o.toDate >= date
  );
  const upcoming = overrideLikes.filter((o) => o.fromDate > date);

  let courts = buildCourtRosterForDate({
    date,
    advocates: advocates.map((a) => {
      const mobile = displayMobile(a.mobile);
      return {
        userId: a.id,
        unitId: a.unitId,
        mobile,
        name: a.name,
        displayName: personDisplayName({
          name: a.name,
          mobile,
          unitId: a.unitId,
        }),
        defaultCourts: parseAdvocateDefaults(a.defaultCourts),
      };
    }),
    overrides: overrideLikes,
  });

  if (q) {
    courts = courts.filter((c) => {
      const hay = `${c.courtName} ${c.city} ${c.district} ${c.state}`.toLowerCase();
      const people = [...c.permanent, ...c.covering]
        .map((p) => p.displayName)
        .join(" ")
        .toLowerCase();
      return hay.includes(q) || people.includes(q);
    });
  }

  return jsonOk({
    date,
    courts,
    activeOverrides: activeOnDate,
    upcomingOverrides: upcoming.slice(0, 40),
  });
});
