import { getStageOptionsForCaseType } from "@meiyon/config";

export const UNSET_COURT_STATUS = "__unset__";

export type BoardCaseRow = {
  unitId: string;
  status: string;
  stage: string | null;
  caseType: string | null;
  caseNumber: string | null;
  clientName: string | null;
  clientUnitId: string;
  opposingParty: string | null;
  ourSide: string | null;
  nextHearingAt: string | null;
  battaDue: boolean;
  agreedFee: number | null;
};

/** Kanban columns for a case type (court status catalog). */
export function boardCourtStatusColumns(caseType: string): string[] {
  return getStageOptionsForCaseType(caseType).map((o) => o.value);
}

export function groupCasesByCourtStatus<T extends { stage: string | null }>(
  rows: T[],
  columns: string[]
): Record<string, T[]> {
  const groups: Record<string, T[]> = { [UNSET_COURT_STATUS]: [] };
  for (const col of columns) groups[col] = [];
  const known = new Set(columns);
  for (const row of rows) {
    const s = (row.stage ?? "").trim();
    if (!s) {
      groups[UNSET_COURT_STATUS].push(row);
    } else if (known.has(s)) {
      groups[s].push(row);
    } else {
      // Custom / other-track status — keep visible under unset + label via card
      groups[UNSET_COURT_STATUS].push(row);
    }
  }
  return groups;
}
