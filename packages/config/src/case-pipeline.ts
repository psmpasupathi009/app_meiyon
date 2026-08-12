/**
 * Office pipeline status for matters (Layer A).
 * Court-board detail stays in Case.stage (Layer B).
 */

export const CASE_PIPELINE_STATUSES = [
  "enquiry",
  "engaged",
  "pre_filing",
  "under_filing",
  "filing_defect",
  "active",
  "reserved",
  "disposed",
  "withdrawn",
  "transferred",
  "archived",
] as const;

export type CasePipelineStatus = (typeof CASE_PIPELINE_STATUSES)[number];

/** Legacy DB values still possible until migrate script runs. */
export const LEGACY_CASE_STATUS_MAP: Record<string, CasePipelineStatus> = {
  pending: "pre_filing",
  listed: "active",
};

export const CASE_STATUS_OPTIONS: {
  value: CasePipelineStatus;
  label: string;
  short: string;
}[] = [
  { value: "enquiry", label: "Enquiry / consultation", short: "Enquiry" },
  { value: "engaged", label: "Engaged", short: "Engaged" },
  { value: "pre_filing", label: "Pre-filing (draft / prep)", short: "Pre-filing" },
  { value: "under_filing", label: "Under filing", short: "Filing" },
  { value: "filing_defect", label: "Filing defect (returned)", short: "Defect" },
  { value: "active", label: "Active / numbered", short: "Active" },
  { value: "reserved", label: "Judgment reserved", short: "Reserved" },
  { value: "disposed", label: "Disposed", short: "Disposed" },
  { value: "withdrawn", label: "Withdrawn", short: "Withdrawn" },
  { value: "transferred", label: "Transferred", short: "Transferred" },
  { value: "archived", label: "Archived", short: "Archived" },
];

export const CASE_STATUS_LABEL: Record<CasePipelineStatus, string> =
  Object.fromEntries(
    CASE_STATUS_OPTIONS.map((o) => [o.value, o.short])
  ) as Record<CasePipelineStatus, string>;

export type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "destructive"
  | "muted"
  | "gold"
  | "outline";

export const CASE_STATUS_VARIANT: Record<CasePipelineStatus, BadgeVariant> = {
  enquiry: "muted",
  engaged: "gold",
  pre_filing: "warning",
  under_filing: "default",
  filing_defect: "destructive",
  active: "default",
  reserved: "gold",
  disposed: "success",
  withdrawn: "muted",
  transferred: "muted",
  archived: "muted",
};

/** Ordered strip shown on case detail (excludes terminal side-exits). */
export const CASE_PIPELINE_STEPS: CasePipelineStatus[] = [
  "enquiry",
  "engaged",
  "pre_filing",
  "under_filing",
  "filing_defect",
  "active",
  "reserved",
  "disposed",
  "archived",
];

/**
 * Allowed forward / side transitions.
 * Clerks can always jump to withdrawn / transferred from open statuses.
 */
export const CASE_STATUS_TRANSITIONS: Record<
  CasePipelineStatus,
  CasePipelineStatus[]
> = {
  enquiry: ["engaged", "withdrawn"],
  engaged: ["pre_filing", "enquiry", "withdrawn"],
  pre_filing: ["under_filing", "engaged", "withdrawn"],
  under_filing: ["filing_defect", "active", "pre_filing", "withdrawn"],
  filing_defect: ["under_filing", "active", "withdrawn"],
  active: ["reserved", "disposed", "filing_defect", "withdrawn", "transferred"],
  reserved: ["disposed", "active", "withdrawn", "transferred"],
  disposed: ["archived", "active"],
  withdrawn: ["archived", "enquiry"],
  transferred: ["archived"],
  archived: ["active"],
};

export function normalizeCaseStatus(raw: string): CasePipelineStatus {
  if (raw in LEGACY_CASE_STATUS_MAP) return LEGACY_CASE_STATUS_MAP[raw]!;
  if ((CASE_PIPELINE_STATUSES as readonly string[]).includes(raw)) {
    return raw as CasePipelineStatus;
  }
  return "pre_filing";
}

export function canTransitionStatus(
  from: string,
  to: string
): boolean {
  const f = normalizeCaseStatus(from);
  const t = normalizeCaseStatus(to);
  if (f === t) return true;
  return CASE_STATUS_TRANSITIONS[f]?.includes(t) ?? false;
}

/** Statuses selectable in the edit form: current + allowed transitions. */
export function editableStatusValues(
  current: string
): CasePipelineStatus[] {
  const f = normalizeCaseStatus(current);
  const allowed = new Set<CasePipelineStatus>([f]);
  for (const to of CASE_STATUS_TRANSITIONS[f] ?? []) {
    allowed.add(to);
  }
  return CASE_PIPELINE_STATUSES.filter((s) => allowed.has(s));
}

/** Create form: seed at enquiry only (pipeline starts here). */
export function creatableStatusValues(): CasePipelineStatus[] {
  return ["enquiry"];
}

/** Statuses that still need office filing work (pre-number). */
export const PRE_NUMBER_STATUSES: CasePipelineStatus[] = [
  "enquiry",
  "engaged",
  "pre_filing",
  "under_filing",
  "filing_defect",
];

/** Open matters for diary / dashboard style queries. */
export const OPEN_CASE_STATUSES: CasePipelineStatus[] = [
  "enquiry",
  "engaged",
  "pre_filing",
  "under_filing",
  "filing_defect",
  "active",
  "reserved",
];

export const FILING_CHECKLIST_ITEMS = [
  { id: "conflict_check", label: "Conflict check done" },
  { id: "vakalatnama", label: "Vakalatnama ready / filed" },
  { id: "petition_ready", label: "Petition / plaint ready" },
  { id: "court_fee", label: "Court fee / stamp paid" },
  { id: "postal_dak", label: "Postal / dak entry" },
  { id: "presented", label: "Presented at registry" },
  { id: "returned", label: "Returned (defect)" },
  { id: "re_presented", label: "Re-presented" },
  { id: "numbered", label: "Numbered (case no. / CNR)" },
  { id: "batta_due", label: "Batta / process due" },
  { id: "batta_done", label: "Batta / process done" },
  { id: "certified_copy", label: "Certified copy applied" },
] as const;

export type FilingChecklistId = (typeof FILING_CHECKLIST_ITEMS)[number]["id"];

export type FilingChecklistState = Partial<
  Record<FilingChecklistId, boolean>
> & {
  returnReason?: string;
};

export function emptyFilingChecklist(): FilingChecklistState {
  return {};
}
