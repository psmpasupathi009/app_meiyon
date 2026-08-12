import type { Case, Hearing, Prisma } from "@prisma/client";
import {
  normalizeCaseStatus,
  type FilingChecklistState,
} from "@meiyon/config";

export type CaseSummary = {
  unitId: string;
  clientUnitId: string;
  caseNumber: string | null;
  filingNumber: string | null;
  caseYear: number | null;
  cnr: string | null;
  state: string | null;
  district: string | null;
  city: string | null;
  courtName: string | null;
  advocateMobiles: string[];
  primaryAdvocateMobile: string | null;
  opposingParty: string | null;
  ourSide: string | null;
  underActs: string | null;
  policeStation: string | null;
  firNumber: string | null;
  stage: string | null;
  caseType: string | null;
  status: string;
  filingDate: string | null;
  nextHearingAt: string | null;
  agreedFee: number | null;
  notes: string | null;
  filingChecklist: FilingChecklistState;
  battaDue: boolean;
  awaitingService: boolean;
  createdAt: string;
};

function parseChecklist(raw: Prisma.JsonValue | null | undefined): FilingChecklistState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as FilingChecklistState;
}

export function toCaseSummary(item: Case): CaseSummary {
  return {
    unitId: item.unitId,
    clientUnitId: item.clientUnitId,
    caseNumber: item.caseNumber,
    filingNumber: item.filingNumber,
    caseYear: item.caseYear,
    cnr: item.cnr,
    state: item.state,
    district: item.district,
    city: item.city,
    courtName: item.courtName,
    advocateMobiles: item.advocateMobiles,
    primaryAdvocateMobile: item.primaryAdvocateMobile,
    opposingParty: item.opposingParty,
    ourSide: item.ourSide,
    underActs: item.underActs,
    policeStation: item.policeStation,
    firNumber: item.firNumber,
    stage: item.stage,
    caseType: item.caseType,
    status: normalizeCaseStatus(item.status),
    filingDate: item.filingDate ? item.filingDate.toISOString() : null,
    nextHearingAt: item.nextHearingAt ? item.nextHearingAt.toISOString() : null,
    agreedFee: item.agreedFee,
    notes: item.notes,
    filingChecklist: parseChecklist(item.filingChecklist),
    battaDue: item.battaDue ?? false,
    awaitingService: item.awaitingService ?? false,
    createdAt: item.createdAt.toISOString(),
  };
}

export type HearingSummary = {
  unitId: string;
  caseUnitId: string;
  hearingDate: string;
  purpose: string | null;
  notes: string | null;
  outcome: string | null;
  isAdjourned: boolean;
  smsSentAt: string | null;
  createdAt: string;
};

export function toHearingSummary(item: Hearing): HearingSummary {
  return {
    unitId: item.unitId,
    caseUnitId: item.caseUnitId,
    hearingDate: item.hearingDate.toISOString(),
    purpose: item.purpose,
    notes: item.notes,
    outcome: item.outcome,
    isAdjourned: item.isAdjourned,
    smsSentAt: item.smsSentAt ? item.smsSentAt.toISOString() : null,
    createdAt: item.createdAt.toISOString(),
  };
}
