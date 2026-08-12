/**
 * Court-board stages (Layer B) by matter track.
 * Every known case type maps to a procedure-specific catalog.
 * Office pipeline status stays in case-pipeline.ts (Layer A).
 */

import { CASE_TYPES } from "@/config/company/case-types";

export type FormOption = { value: string; label: string };

export type CaseStageTrack =
  | "criminal"
  | "cibil"
  | "execution"
  | "writ"
  | "civil_appeal"
  | "ia"
  | "criminal_appeal"
  | "bail"
  | "warrant"
  | "family"
  | "mact"
  | "consumer"
  | "labour"
  | "general";

function opts(labels: readonly string[]): FormOption[] {
  return labels.map((label) => ({ value: label, label }));
}

/** Private complaint / CC / STC / SC / CRL.OP */
export const CRIMINAL_CASE_STAGES = opts([
  "Legal notice / reply — Served",
  "Legal notice / reply — Returned",
  "Acknowledgment — Received",
  "Acknowledgment — Not received",
  "Filing check case (petition in court)",
  "Sworn statement",
  "Summon to accused",
  "Appearance of accused",
  "Copies",
  "Filing vakalat",
  "Sureties",
  "1st questioning",
  "Complainant side evidence (chief + marking)",
  "Cross-examination",
  "CRLMP / I.A. petition",
  "Accused side evidence",
  "Reopen / recall",
  "2nd questioning",
  "Arguments",
  "Judgement",
  "Suspension of sentence (if conviction)",
  "Copy application",
  "Warrant recall",
  "Appeal",
] as const);

/** OS / CS / CIBIL / OP / AS — suit & recovery board */
export const CIBIL_CASE_STAGES = opts([
  "Filing the suit / petition",
  "Issue to summon / batta",
  "Vakalath / change of vakalath",
  "Counter / written statement",
  "I.A. enquiry",
  "I.A. order",
  "Plaintiff side evidence (PW1–5)",
  "Marking of documents (plaintiff)",
  "Cross of PW1–5",
  "Defendant side evidence (DW1–5)",
  "Marking of documents (defendant)",
  "Cross of DW1–5",
  "Reopen / recall",
  "Oral / written argument",
  "Steps",
  "Judgement / orders",
  "Copy application (C.A / C.C)",
  "Suit / petition miscellaneous",
] as const);

/** EP — execution petition */
export const EXECUTION_CASE_STAGES = opts([
  "Filing EP",
  "Numbering / defects",
  "Notice to JD / batta",
  "Vakalath",
  "Counter / objections",
  "Enquiry",
  "Attachment of property",
  "Arrest / detention steps (if money decree)",
  "Sale proclamation",
  "Auction / sale",
  "Confirmation of sale",
  "Delivery of possession",
  "Part satisfaction / full satisfaction",
  "EP I.A. / miscellaneous",
  "Orders",
  "Copy application",
  "Appeal / revision",
] as const);

/** WP / WA — writ */
export const WRIT_CASE_STAGES = opts([
  "Filing writ petition / appeal",
  "Defect / return / re-present",
  "Numbered",
  "Admission",
  "Notice ordered",
  "Interim / stay petition",
  "Interim order",
  "Counter affidavit",
  "Reply affidavit",
  "Additional / rejoinder affidavit",
  "Implead / WMP / miscellaneous",
  "Arguments",
  "Reserved for orders",
  "Final order / judgment",
  "Copy application",
  "Contempt / compliance",
  "Further appeal",
] as const);

/** CMA / CRP — civil misc appeal / revision */
export const CIVIL_APPEAL_CASE_STAGES = opts([
  "Filing CMA / CRP",
  "Defect / return / re-present",
  "Numbered",
  "Stay / interim application",
  "Stay order",
  "Notice / batta",
  "Vakalath",
  "Counter / objections",
  "Call for lower court records",
  "Records received",
  "Arguments",
  "Reserved",
  "Judgment / order",
  "Copy application",
  "Further appeal",
] as const);

/** IA — interlocutory application (standalone or on main matter) */
export const IA_CASE_STAGES = opts([
  "Filing I.A.",
  "Defect / numbering",
  "Notice / batta",
  "Counter affidavit",
  "Enquiry",
  "Arguments",
  "I.A. order",
  "Compliance / steps",
  "Copy application",
  "Disposed / closed",
] as const);

/** CRL.A / CRL.RC */
export const CRIMINAL_APPEAL_CASE_STAGES = opts([
  "Filing criminal appeal / revision",
  "Defect / return / re-present",
  "Numbered",
  "Suspension of sentence petition",
  "Bail pending appeal",
  "Notice to respondent / State",
  "Vakalath",
  "Call for records",
  "Records received",
  "Arguments",
  "Reserved",
  "Judgment / order",
  "Copy application",
  "Further appeal / SLP",
] as const);

/** Bail application */
export const BAIL_CASE_STAGES = opts([
  "Filing bail petition",
  "Defect / return / re-present",
  "Numbered",
  "Notice to APP / complainant",
  "Custody certificate / remand details",
  "Counter / objections",
  "Arguments",
  "Order — bail granted",
  "Order — bail dismissed",
  "Sureties verification",
  "Bonds executed",
  "Release order",
  "Cancellation / modification petition",
  "Copy application",
] as const);

/** NBW / warrant related */
export const WARRANT_CASE_STAGES = opts([
  "NBW / bailable warrant issued",
  "Batta / process to police",
  "Await execution report",
  "Execution report — not executed",
  "Execution report — arrested",
  "Production before court",
  "Petition to recall warrant",
  "Warrant recalled",
  "Fresh / reissued warrant",
  "Bail / sureties after production",
  "Order on recall / disposal",
  "Copy application",
] as const);

/** HMOP / MC — family / matrimonial */
export const FAMILY_CASE_STAGES = opts([
  "Filing petition",
  "Issue summons / notice",
  "Vakalath / change of vakalath",
  "Counter / written statement",
  "I.A. enquiry",
  "I.A. order",
  "Counselling / mediation",
  "Interim maintenance / custody",
  "Petitioner side evidence",
  "Marking of documents",
  "Cross-examination",
  "Respondent side evidence",
  "Reopen / recall",
  "Arguments",
  "Judgment / decree",
  "Copy application",
  "Execution / appeal",
] as const);

/** MACT */
export const MACT_CASE_STAGES = opts([
  "Filing claim petition",
  "Numbering / defects",
  "Notice to owner / driver / insurer",
  "Vakalath",
  "Counter / written statement",
  "I.A. / interim application",
  "Claimant evidence (PW)",
  "Marking of documents",
  "Cross of claimant",
  "Medical / disability evidence",
  "Respondent / insurer evidence (RW)",
  "Arguments",
  "Award / order",
  "Deposit by insurer",
  "Disbursement / compliance",
  "Copy application",
  "Appeal",
] as const);

/** Consumer complaint */
export const CONSUMER_CASE_STAGES = opts([
  "Filing complaint",
  "Scrutiny / admission",
  "Numbered",
  "Notice to opposite party",
  "Appearance / vakalat",
  "Version / written statement",
  "Interim application / order",
  "Complainant evidence",
  "Marking of documents",
  "Cross-examination",
  "Opposite party evidence",
  "Arguments",
  "Final order",
  "Execution / compliance",
  "Copy application",
  "Appeal / revision",
] as const);

/** Labour / industrial */
export const LABOUR_CASE_STAGES = opts([
  "Filing claim / petition",
  "Numbering / defects",
  "Notice to management / workmen",
  "Appearance / vakalat",
  "Counter / reply statement",
  "Conciliation / settlement attempt",
  "Issues framed",
  "Claimant evidence",
  "Marking of documents",
  "Cross-examination",
  "Management evidence",
  "Arguments",
  "Award / order",
  "Copy application",
  "Execution / appeal",
] as const);

/** Fallback — Other / unknown */
export const GENERAL_CASE_STAGES: FormOption[] = [
  { value: "Filing", label: "Filing" },
  { value: "Registration", label: "Registration" },
  { value: "Summon / Notice", label: "Summon / Notice" },
  { value: "Appearance", label: "Appearance" },
  { value: "Pleadings", label: "Pleadings" },
  { value: "Issues framed", label: "Issues framed" },
  { value: "Evidence", label: "Evidence" },
  { value: "Cross-examination", label: "Cross-examination" },
  { value: "Arguments", label: "Arguments" },
  { value: "Judgment reserved", label: "Judgment reserved" },
  { value: "Judgment / Order", label: "Judgment / Order" },
  { value: "Execution", label: "Execution" },
  { value: "Appeal pending", label: "Appeal pending" },
  { value: "Disposed", label: "Disposed" },
];

const STAGES_BY_TRACK: Record<CaseStageTrack, FormOption[]> = {
  criminal: CRIMINAL_CASE_STAGES,
  cibil: CIBIL_CASE_STAGES,
  execution: EXECUTION_CASE_STAGES,
  writ: WRIT_CASE_STAGES,
  civil_appeal: CIVIL_APPEAL_CASE_STAGES,
  ia: IA_CASE_STAGES,
  criminal_appeal: CRIMINAL_APPEAL_CASE_STAGES,
  bail: BAIL_CASE_STAGES,
  warrant: WARRANT_CASE_STAGES,
  family: FAMILY_CASE_STAGES,
  mact: MACT_CASE_STAGES,
  consumer: CONSUMER_CASE_STAGES,
  labour: LABOUR_CASE_STAGES,
  general: GENERAL_CASE_STAGES,
};

/**
 * Explicit map for every known case type value.
 * Keep in sync with CASE_TYPE_GROUPS in case-types.ts.
 */
export const CASE_STAGE_TRACK_BY_TYPE: Record<string, CaseStageTrack> = {
  // Civil / recovery
  OS: "cibil",
  CS: "cibil",
  CIBIL: "cibil",
  OP: "cibil",
  AS: "cibil",
  EP: "execution",
  WP: "writ",
  WA: "writ",
  CMA: "civil_appeal",
  CRP: "civil_appeal",
  IA: "ia",
  // Criminal
  CC: "criminal",
  STC: "criminal",
  SC: "criminal",
  "CRL.OP": "criminal",
  "CRL.A": "criminal_appeal",
  "CRL.RC": "criminal_appeal",
  Bail: "bail",
  NBW: "warrant",
  // Family / others
  HMOP: "family",
  MC: "family",
  MACT: "mact",
  Consumer: "consumer",
  Labour: "labour",
  Other: "general",
};

export function resolveCaseStageTrack(
  caseType: string | null | undefined
): CaseStageTrack {
  const t = (caseType ?? "").trim();
  if (!t) return "general";
  return CASE_STAGE_TRACK_BY_TYPE[t] ?? "general";
}

export function getStageOptionsForCaseType(
  caseType: string | null | undefined
): FormOption[] {
  return STAGES_BY_TRACK[resolveCaseStageTrack(caseType)];
}

/** Hearing purpose options follow the same board language as stages. */
export function getHearingPurposeOptionsForCaseType(
  caseType: string | null | undefined
): FormOption[] {
  return getStageOptionsForCaseType(caseType);
}

export function isKnownStageForCaseType(
  stage: string,
  caseType: string | null | undefined
): boolean {
  return getStageOptionsForCaseType(caseType).some((o) => o.value === stage);
}

/** True if `stage` appears in any track catalog. */
export function isCatalogStage(stage: string): boolean {
  const s = stage.trim();
  if (!s) return false;
  return (Object.values(STAGES_BY_TRACK) as FormOption[][]).some((opts) =>
    opts.some((o) => o.value === s)
  );
}

/**
 * Stage is allowed for a case type when:
 * - empty, or
 * - in the type's track catalog, or
 * - free-text (not in any track catalog).
 * Rejects cross-track catalog stages (e.g. CIBIL stage on a CC matter).
 */
export function isStageAllowedForCaseType(
  stage: string | null | undefined,
  caseType: string | null | undefined
): boolean {
  const s = (stage ?? "").trim();
  if (!s) return true;
  if (isKnownStageForCaseType(s, caseType)) return true;
  if (!isCatalogStage(s)) return true; // genuine free-text
  return false;
}

export function stageValidationMessage(
  stage: string,
  caseType: string | null | undefined
): string {
  const track = resolveCaseStageTrack(caseType);
  return `Stage “${stage}” does not belong to case type ${caseType || "(none)"} (${track} track). Pick a stage for this type or clear it.`;
}

/**
 * Resolve stage to persist when caseType and/or stage change.
 * Clears incompatible stages (same as form handleCaseTypeChange).
 */
export function resolveStageForSave(input: {
  nextStage: string | null | undefined;
  nextCaseType: string | null | undefined;
  prevStage: string | null | undefined;
  prevCaseType: string | null | undefined;
  stageProvided: boolean;
  caseTypeProvided: boolean;
}): { ok: true; stage: string | null } | { ok: false; message: string } {
  const caseType = input.caseTypeProvided
    ? input.nextCaseType || null
    : input.prevCaseType || null;

  let stage: string | null;
  if (input.stageProvided) {
    const raw = input.nextStage;
    stage = raw === "" || raw == null ? null : String(raw).trim() || null;
  } else {
    stage = input.prevStage ?? null;
  }

  if (!stage) return { ok: true, stage: null };

  if (!isStageAllowedForCaseType(stage, caseType)) {
    // Type changed and old stage is incompatible → clear (form parity)
    if (
      input.caseTypeProvided &&
      !input.stageProvided &&
      (input.nextCaseType || null) !== (input.prevCaseType || null)
    ) {
      return { ok: true, stage: null };
    }
    // Explicit incompatible stage on create/update → reject
    if (input.stageProvided) {
      return {
        ok: false,
        message: stageValidationMessage(stage, caseType),
      };
    }
    // Type changed without sending stage, and prev incompatible → clear
    return { ok: true, stage: null };
  }

  return { ok: true, stage };
}

/** Assert coverage: every seeded case type has an explicit track. */
export function unmappedCaseTypes(): string[] {
  return CASE_TYPES.map((t) => t.value).filter(
    (v) => !(v in CASE_STAGE_TRACK_BY_TYPE)
  );
}

/** @deprecated Prefer getStageOptionsForCaseType(caseType). */
export const CASE_STAGE_OPTIONS = GENERAL_CASE_STAGES;
