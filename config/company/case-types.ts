export const CASE_TYPE_GROUPS = [
  {
    group: "Civil",
    types: [
      { value: "OS", label: "OS — Original Suit" },
      { value: "CS", label: "CS — Civil Suit" },
      { value: "CIBIL", label: "CIBIL — Credit / recovery suit" },
      { value: "WP", label: "WP — Writ Petition" },
      { value: "WA", label: "WA — Writ Appeal" },
      { value: "AS", label: "AS — Appeal Suit" },
      { value: "CMA", label: "CMA — Civil Misc. Appeal" },
      { value: "CRP", label: "CRP — Civil Revision Petition" },
      { value: "EP", label: "EP — Execution Petition" },
      { value: "IA", label: "IA — Interlocutory Application" },
      { value: "OP", label: "OP — Original Petition" },
    ],
  },
  {
    group: "Criminal",
    types: [
      { value: "CC", label: "CC — Calendar Case" },
      { value: "STC", label: "STC — Summary Trial Case" },
      { value: "SC", label: "SC — Sessions Case" },
      { value: "CRL.A", label: "CRL.A — Criminal Appeal" },
      { value: "CRL.RC", label: "CRL.RC — Criminal Revision" },
      { value: "CRL.OP", label: "CRL.OP — Criminal O.P." },
      { value: "Bail", label: "Bail Application" },
      { value: "NBW", label: "NBW / Warrant related" },
    ],
  },
  {
    group: "Family / others",
    types: [
      { value: "HMOP", label: "HMOP — Hindu Marriage O.P." },
      { value: "MC", label: "MC — Matrimonial Case" },
      { value: "MACT", label: "MACT — Motor Accident Claim" },
      { value: "Consumer", label: "Consumer Complaint" },
      { value: "Labour", label: "Labour / Industrial" },
      { value: "Other", label: "Other" },
    ],
  },
] as const;

export type CaseTypeValue = (typeof CASE_TYPE_GROUPS)[number]["types"][number]["value"];

export const CASE_TYPES: { value: string; label: string }[] =
  CASE_TYPE_GROUPS.flatMap((g) => [...g.types]);

/** @deprecated Prefer CASE_STATUS_OPTIONS from case-pipeline.ts */
export {
  CASE_STATUS_OPTIONS,
  CASE_STATUS_LABEL,
  CASE_STATUS_VARIANT,
  normalizeCaseStatus,
} from "@/config/company/case-pipeline";

/** Normalize CNR: strip spaces/dashes, uppercase. Empty → "". */
export function normalizeCnr(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

/** eCourts CNR is 16 alphanumeric characters (dashes optional in UI). */
export function isValidCnr(input: string): boolean {
  const n = normalizeCnr(input);
  if (!n) return true; // optional
  return /^[A-Z0-9]{16}$/.test(n);
}
