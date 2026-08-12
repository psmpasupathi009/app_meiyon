/** Allowed CSV headers per import entity (KEEP lists). Extra headers are ignored. */

export const IMPORT_CLIENT_COLUMNS = ["unitId", "name", "mobile"] as const;

export const IMPORT_CASE_COLUMNS = [
  "unitId",
  "clientUnitId",
  "caseNumber",
  "cnr",
  "courtName",
  "caseType",
  "status",
  "filingDate",
  "nextHearingAt",
  "agreedFee",
  "primaryAdvocateMobile",
  "notes",
] as const;

export const IMPORT_HEARING_COLUMNS = [
  "caseUnitId",
  "hearingDate",
  "purpose",
  "notes",
] as const;

export const IMPORT_PAYMENT_COLUMNS = [
  "clientUnitId",
  "caseUnitId",
  "type",
  "amount",
  "status",
  "paidOn",
  "notes",
] as const;

export const IMPORT_EMPLOYEE_COLUMNS = [
  "unitId",
  "name",
  "designation",
  "mobile",
  "defaultState",
  "defaultDistrict",
  "defaultCity",
  "defaultCourtNames",
] as const;

export const IMPORT_DAK_COLUMNS = [
  "direction",
  "entryDate",
  "subject",
  "fromTo",
  "caseUnitId",
  "clientUnitId",
  "notes",
] as const;

export const IMPORT_TASK_COLUMNS = [
  "title",
  "workDate",
  "assigneeUnitId",
  "caseUnitId",
  "kind",
] as const;

export const IMPORT_APPOINTMENT_COLUMNS = [
  "title",
  "scheduledAt",
  "advocateMobile",
  "clientUnitId",
  "caseUnitId",
  "durationMin",
  "mode",
] as const;

/** Headers present on rows but not in the KEEP allow-list. */
export function findIgnoredImportColumns(
  rows: Record<string, string>[],
  allowed: readonly string[]
): string[] {
  const allowedSet = new Set(allowed);
  const ignored = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!allowedSet.has(key)) ignored.add(key);
    }
  }
  return [...ignored].sort();
}
