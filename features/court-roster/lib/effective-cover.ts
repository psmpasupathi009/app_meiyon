import {
  courtKey,
  parseDefaultCourts,
  type DefaultCourt,
} from "@/lib/hearings/court-key";
import { istAddCalendarDays } from "@/lib/utils/ist";

export type CoverAdvocate = {
  userId: string;
  unitId: string;
  mobile: string;
  name: string | null;
  displayName: string;
};

export type CourtDutyOverrideLike = {
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
  reason?: string | null;
  advocateName?: string | null;
  advocateDisplayName?: string;
};

export type CourtRosterRow = {
  key: string;
  state: string;
  district: string;
  city: string;
  courtName: string;
  permanent: CoverAdvocate[];
  /** Effective covering advocates for the selected date (override replaces permanents). */
  covering: CoverAdvocate[];
  activeOverride: CourtDutyOverrideLike | null;
};

/** Inclusive YYYY-MM-DD overlap (lexicographic works for ISO dates). */
export function dateRangesOverlap(
  aFrom: string,
  aTo: string,
  bFrom: string,
  bTo: string
): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}

export function isDateInRange(
  date: string,
  fromDate: string,
  toDate: string
): boolean {
  return date >= fromDate && date <= toDate;
}

/** Each IST calendar day from fromDate through toDate inclusive. */
export function eachIstDateInclusive(fromDate: string, toDate: string): string[] {
  if (fromDate > toDate) return [];
  const out: string[] = [];
  let cur = fromDate;
  while (cur <= toDate) {
    out.push(cur);
    cur = istAddCalendarDays(cur, 1);
  }
  return out;
}

export function findOverlappingOverride(
  existing: Array<{
    unitId: string;
    state: string;
    district: string;
    city: string;
    courtName: string;
    fromDate: string;
    toDate: string;
  }>,
  candidate: {
    state: string;
    district: string;
    city: string;
    courtName: string;
    fromDate: string;
    toDate: string;
  },
  excludeUnitId?: string
): { unitId: string } | null {
  const key = courtKey(candidate);
  for (const row of existing) {
    if (excludeUnitId && row.unitId === excludeUnitId) continue;
    if (courtKey(row) !== key) continue;
    if (
      dateRangesOverlap(
        row.fromDate,
        row.toDate,
        candidate.fromDate,
        candidate.toDate
      )
    ) {
      return { unitId: row.unitId };
    }
  }
  return null;
}

/**
 * Same advocate cannot be temporary cover at two different courts on overlapping dates.
 */
export function findAdvocateDutyClash(
  existing: Array<{
    unitId: string;
    advocateUnitId: string;
    state: string;
    district: string;
    city: string;
    courtName: string;
    fromDate: string;
    toDate: string;
  }>,
  candidate: {
    advocateUnitId: string;
    state: string;
    district: string;
    city: string;
    courtName: string;
    fromDate: string;
    toDate: string;
  },
  excludeUnitId?: string
): { unitId: string; courtName: string } | null {
  const targetKey = courtKey(candidate);
  for (const row of existing) {
    if (excludeUnitId && row.unitId === excludeUnitId) continue;
    if (row.advocateUnitId !== candidate.advocateUnitId) continue;
    if (courtKey(row) === targetKey) continue;
    if (
      dateRangesOverlap(
        row.fromDate,
        row.toDate,
        candidate.fromDate,
        candidate.toDate
      )
    ) {
      return { unitId: row.unitId, courtName: row.courtName };
    }
  }
  return null;
}

/**
 * End an override as of "today":
 * - future-only → delete
 * - already past → delete (cleanup)
 * - started today → delete (nothing to keep)
 * - active with past days → truncate toDate to yesterday
 */
export function resolveEndOverride(input: {
  fromDate: string;
  toDate: string;
  today: string;
}): { action: "delete" } | { action: "truncate"; toDate: string } {
  if (input.fromDate > input.today) return { action: "delete" };
  if (input.toDate < input.today) return { action: "delete" };
  const yesterday = istAddCalendarDays(input.today, -1);
  if (yesterday < input.fromDate) return { action: "delete" };
  return { action: "truncate", toDate: yesterday };
}

type AdvocateWithDefaults = CoverAdvocate & {
  defaultCourts: DefaultCourt[];
};

/**
 * Build roster rows for a date: invert permanent defaults, apply active override
 * (one primary cover wins over permanents for that court/date).
 */
export function buildCourtRosterForDate(input: {
  date: string;
  advocates: AdvocateWithDefaults[];
  overrides: CourtDutyOverrideLike[];
}): CourtRosterRow[] {
  const byKey = new Map<
    string,
    {
      court: DefaultCourt;
      permanent: CoverAdvocate[];
    }
  >();

  for (const adv of input.advocates) {
    for (const c of adv.defaultCourts) {
      const key = courtKey(c);
      if (!key || key === "|||") continue;
      let row = byKey.get(key);
      if (!row) {
        row = { court: c, permanent: [] };
        byKey.set(key, row);
      }
      if (!row.permanent.some((p) => p.unitId === adv.unitId)) {
        row.permanent.push({
          userId: adv.userId,
          unitId: adv.unitId,
          mobile: adv.mobile,
          name: adv.name,
          displayName: adv.displayName,
        });
      }
    }
  }

  for (const ov of input.overrides) {
    const key = courtKey(ov);
    if (!key || key === "|||") continue;
    if (!byKey.has(key)) {
      byKey.set(key, {
        court: {
          state: ov.state,
          district: ov.district,
          city: ov.city,
          courtName: ov.courtName,
        },
        permanent: [],
      });
    }
  }

  const rows: CourtRosterRow[] = [];
  for (const [key, { court, permanent }] of byKey) {
    const active =
      input.overrides.find(
        (o) =>
          courtKey(o) === key &&
          isDateInRange(input.date, o.fromDate, o.toDate)
      ) ?? null;

    const covering: CoverAdvocate[] = active
      ? [
          {
            userId: active.advocateUserId,
            unitId: active.advocateUnitId,
            mobile: active.advocateMobile,
            name: active.advocateName ?? null,
            displayName:
              active.advocateDisplayName ??
              active.advocateName ??
              active.advocateMobile,
          },
        ]
      : permanent;

    rows.push({
      key,
      state: court.state,
      district: court.district,
      city: court.city,
      courtName: court.courtName,
      permanent,
      covering,
      activeOverride: active,
    });
  }

  rows.sort((a, b) => {
    const loc = `${a.district} ${a.city} ${a.courtName}`.localeCompare(
      `${b.district} ${b.city} ${b.courtName}`
    );
    return loc;
  });

  return rows;
}

export function parseAdvocateDefaults(
  raw: unknown
): DefaultCourt[] {
  return parseDefaultCourts(raw);
}

/** Add court to defaults if missing (by courtKey). */
export function addCourtToDefaults(
  existing: DefaultCourt[],
  court: DefaultCourt
): DefaultCourt[] {
  const key = courtKey(court);
  if (existing.some((c) => courtKey(c) === key)) return existing;
  return [...existing, court];
}

/** Remove court from defaults by courtKey. */
export function removeCourtFromDefaults(
  existing: DefaultCourt[],
  court: DefaultCourt
): DefaultCourt[] {
  const key = courtKey(court);
  return existing.filter((c) => courtKey(c) !== key);
}
