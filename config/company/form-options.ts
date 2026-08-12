/**
 * Shared dropdown options for office forms.
 * Free-text fields that must stay free (name, mobile, CNR, notes…) stay as inputs.
 * Use SelectOrOther when staff may need a custom value.
 */

export type FormOption = { value: string; label: string };

/** @deprecated Prefer getStageOptionsForCaseType from case-stages.ts */
export { CASE_STAGE_OPTIONS } from "@/config/company/case-stages";

export const UNDER_ACTS_OPTIONS: FormOption[] = [
  { value: "IPC", label: "IPC" },
  { value: "BNS 2023", label: "BNS 2023" },
  { value: "CrPC / BNSS", label: "CrPC / BNSS" },
  { value: "NI Act — Sec 138", label: "NI Act — Sec 138" },
  { value: "Domestic Violence Act", label: "Domestic Violence Act" },
  { value: "Hindu Marriage Act", label: "Hindu Marriage Act" },
  { value: "CPC", label: "CPC" },
  { value: "Motor Vehicles Act", label: "Motor Vehicles Act" },
  { value: "Labour / Industrial", label: "Labour / Industrial" },
  { value: "Consumer Protection Act", label: "Consumer Protection Act" },
  { value: "POCSO", label: "POCSO" },
  { value: "SC/ST Act", label: "SC/ST Act" },
];

export function caseYearOptions(span = 15): FormOption[] {
  const y = new Date().getFullYear();
  return Array.from({ length: span }, (_, i) => {
    const year = String(y - i);
    return { value: year, label: year };
  });
}

export const OCCUPATION_OPTIONS: FormOption[] = [
  { value: "Agriculture", label: "Agriculture" },
  { value: "Business", label: "Business" },
  { value: "Private employee", label: "Private employee" },
  { value: "Government employee", label: "Government employee" },
  { value: "Self-employed", label: "Self-employed" },
  { value: "Student", label: "Student" },
  { value: "Homemaker", label: "Homemaker" },
  { value: "Retired", label: "Retired" },
  { value: "Unemployed", label: "Unemployed" },
  { value: "Advocate", label: "Advocate" },
  { value: "Doctor", label: "Doctor" },
  { value: "Teacher", label: "Teacher" },
];

export const RELATION_PREFIX_OPTIONS: FormOption[] = [
  { value: "S/o", label: "S/o — Son of" },
  { value: "D/o", label: "D/o — Daughter of" },
  { value: "W/o", label: "W/o — Wife of" },
  { value: "H/o", label: "H/o — Husband of" },
  { value: "C/o", label: "C/o — Care of" },
  { value: "Guardian of", label: "Guardian of" },
];

export const REFERRED_BY_OPTIONS: FormOption[] = [
  { value: "Walk-in", label: "Walk-in" },
  { value: "Existing client", label: "Existing client" },
  { value: "Advocate referral", label: "Advocate referral" },
  { value: "Friend / relative", label: "Friend / relative" },
  { value: "Online / phone", label: "Online / phone" },
  { value: "Court premises", label: "Court premises" },
];

export const APPOINTMENT_TITLE_OPTIONS: FormOption[] = [
  { value: "First consultation", label: "First consultation" },
  { value: "Case discussion", label: "Case discussion" },
  { value: "Document review", label: "Document review" },
  { value: "Vakalat / engagement", label: "Vakalat / engagement" },
  { value: "Hearing prep", label: "Hearing prep" },
  { value: "Follow-up", label: "Follow-up" },
  { value: "Fee / settlement talk", label: "Fee / settlement talk" },
];

export const APPOINTMENT_DURATION_OPTIONS: FormOption[] = [
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "120", label: "2 hours" },
];

/** @deprecated Booking uses mode only (office / call / video). Kept for legacy rows. */
export const APPOINTMENT_LOCATION_OPTIONS: FormOption[] = [
  { value: "Office chamber", label: "Office chamber" },
  { value: "Gobichettipalayam chamber", label: "Gobichettipalayam chamber" },
  { value: "Erode court complex", label: "Erode court complex" },
  { value: "Phone call", label: "Phone call" },
  { value: "Video call", label: "Video call" },
];

/** @deprecated Prefer getHearingPurposeOptionsForCaseType from case-stages.ts */
export { GENERAL_CASE_STAGES as HEARING_PURPOSE_OPTIONS } from "@/config/company/case-stages";

export const ADJOURN_OUTCOME_OPTIONS: FormOption[] = [
  { value: "Adjourned — counsel request", label: "Adjourned — counsel request" },
  { value: "Adjourned — party request", label: "Adjourned — party request" },
  { value: "Adjourned — court busy", label: "Adjourned — court busy" },
  { value: "Adjourned — for evidence", label: "Adjourned — for evidence" },
  { value: "Adjourned — for arguments", label: "Adjourned — for arguments" },
  { value: "Adjourned — for judgment", label: "Adjourned — for judgment" },
  { value: "Part-heard", label: "Part-heard" },
  { value: "Not reached", label: "Not reached" },
];

export const LEAVE_REASON_OPTIONS: FormOption[] = [
  { value: "Personal", label: "Personal" },
  { value: "Medical", label: "Medical" },
  { value: "Family emergency", label: "Family emergency" },
  { value: "Court elsewhere", label: "Court elsewhere" },
  { value: "Festival / holiday travel", label: "Festival / holiday travel" },
];

/**
 * @deprecated Client intake uses locations-seed cascade instead.
 * Kept for any legacy references.
 */
export const OFFICE_DISTRICT_OPTIONS: FormOption[] = [
  { value: "Erode", label: "Erode" },
  { value: "Coimbatore", label: "Coimbatore" },
  { value: "Tiruppur", label: "Tiruppur" },
  { value: "Salem", label: "Salem" },
  { value: "Namakkal", label: "Namakkal" },
  { value: "Karur", label: "Karur" },
  { value: "Nilgiris", label: "Nilgiris" },
  { value: "Chennai", label: "Chennai" },
  { value: "Bengaluru Urban", label: "Bengaluru Urban" },
  { value: "Mysuru", label: "Mysuru" },
];
