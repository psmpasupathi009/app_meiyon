import type { User } from "@prisma/client";

export type OfficeScope = Pick<User, "officeId" | "officeUnitId">;

export function officeWhere(scope: OfficeScope) {
  return { officeId: scope.officeId };
}

export function officeData(scope: OfficeScope) {
  return { officeId: scope.officeId, officeUnitId: scope.officeUnitId };
}

/** Cross-office unitId lookups must 404 — use findFirst with officeId. */
export function unitIdWhere(unitId: string, scope: OfficeScope) {
  return { unitId, officeId: scope.officeId };
}
