/** Max staff IDs accepted on list/export query (URL + abuse guard). */
export const ATTENDANCE_SCOPE_MAX_IDS = 100;

/** Collect employee unit ids from `userUnitId` / `userUnitIds` query params. */
export function parseAttendanceUserUnitIds(
  searchParams: URLSearchParams
): string[] {
  const chunks = [
    ...searchParams.getAll("userUnitId"),
    searchParams.get("userUnitIds") ?? "",
  ];
  const ids = chunks
    .flatMap((s) => s.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(ids)].slice(0, ATTENDANCE_SCOPE_MAX_IDS);
}

export type AttendanceListScope = "all" | "selected" | "mine";

/**
 * Client helper: set list/export scope query params.
 * Managers: `all=1` or `userUnitIds=a,b,c`. Everyone else: `mine=1`.
 */
export function applyAttendanceScopeParams(
  params: URLSearchParams,
  opts: {
    canManage: boolean;
    scope: AttendanceListScope;
    unitIds?: readonly string[];
  }
): void {
  if (opts.canManage && opts.scope === "all") {
    params.set("all", "1");
    return;
  }
  if (opts.canManage && opts.scope === "selected") {
    const ids = [...new Set(opts.unitIds ?? [])]
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, ATTENDANCE_SCOPE_MAX_IDS);
    // Always send the key so the API applies selected-scope (empty → no rows),
    // never accidental default-to-self.
    params.set("userUnitIds", ids.join(","));
    return;
  }
  params.set("mine", "1");
}

/** Manager list/export scope: all, one/many unitIds, or self. */
export function attendanceQueryScope(opts: {
  canManage: boolean;
  all: boolean;
  mine: boolean;
  userUnitIds: string[];
  userId: string;
}):
  | Record<string, never>
  | { userUnitId: string }
  | { userUnitId: { in: string[] } }
  | { userId: string } {
  if (!opts.canManage || opts.mine) return { userId: opts.userId };
  if (opts.all) return {};
  if (opts.userUnitIds.length === 1) {
    return { userUnitId: opts.userUnitIds[0]! };
  }
  if (opts.userUnitIds.length > 1) {
    return { userUnitId: { in: opts.userUnitIds } };
  }
  // Manager with neither all nor ids → empty set (do not leak self as “office”).
  return { userUnitId: { in: [] } };
}

/** True when from/to are both set and from > to. */
export function isInvalidAttendanceDateRange(
  from: string | null | undefined,
  to: string | null | undefined
): boolean {
  if (!from || !to) return false;
  return from > to;
}
