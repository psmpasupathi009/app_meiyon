import type { UserRole } from "@prisma/client";

/**
 * Job titles for a law office / chamber (India + global mid-size practice).
 * Designation = visiting-card title (display + create prefill).
 * Roles = app access — never derived from designation at runtime.
 *
 * Roles stay at 5: admin | sub_admin | advocate | staff | accountant.
 * Do not invent a system role per title.
 */
export const DESIGNATION_GROUPS = [
  {
    label: "Legal",
    items: [
      "Managing Partner",
      "Partner",
      "Senior Advocate",
      "Advocate on Record",
      "Advocate",
      "Counsel",
      "Junior Advocate",
      "Senior Associate",
      "Associate",
      "Of Counsel",
      "Consultant",
      "Legal Advisor",
      "Notary",
      "Intern",
    ],
  },
  {
    label: "Legal support",
    items: [
      "Paralegal",
      "Legal Assistant",
      "Legal Secretary",
      "Personal Assistant",
      "Case Manager",
      "Chamber Clerk",
      "Head Clerk",
      "Senior Clerk",
      "Advocate Clerk",
      "Court Clerk",
      "Diary Clerk",
      "Clerk",
      "Research Assistant",
      "Documentation Assistant",
      "Translator",
      "Stenographer",
      "Typist",
      "Law Clerk",
      "Process Server",
    ],
  },
  {
    label: "Office & accounts",
    items: [
      "Office Manager",
      "HR Manager",
      "Office Executive",
      "Receptionist",
      "Accounts Manager",
      "Accountant",
      "Accounts Assistant",
      "Cashier",
      "Computer Operator",
      "Driver",
      "Messenger",
      "Office Attendant",
    ],
  },
] as const;

export type Designation = (typeof DESIGNATION_GROUPS)[number]["items"][number];

/** Flat list for selects / zod — derived from groups (single source of truth). */
export const DESIGNATIONS = DESIGNATION_GROUPS.flatMap(
  (g) => g.items
) as unknown as readonly [Designation, ...Designation[]];

/**
 * Old CSV / DB labels and common alternate titles → current designation.
 * Keeps imports and legacy rows working without inventing extra roles.
 */
export const LEGACY_DESIGNATION_ALIASES: Record<string, Designation> = {
  Administration: "Office Manager",
  "Admin Manager": "Office Manager",
  "Administrative Manager": "Office Manager",
  Peon: "Office Attendant",
  "Office Boy": "Office Attendant",
  "Office Helper": "Office Attendant",
  "Tea Boy": "Office Attendant",
  Sweeper: "Office Attendant",
  Housekeeping: "Office Attendant",
  Cleaner: "Office Attendant",
  Watchman: "Office Attendant",
  "Security Guard": "Office Attendant",
  "Associate Advocate": "Associate",
  "Junior Associate": "Associate",
  "Junior Counsel": "Junior Advocate",
  "Briefing Counsel": "Junior Advocate",
  "Trainee Advocate": "Junior Advocate",
  "Standing Counsel": "Counsel",
  "Appearing Counsel": "Counsel",
  "Drafting Counsel": "Counsel",
  "Guest Counsel": "Counsel",
  "Visiting Counsel": "Counsel",
  "External Counsel": "Counsel",
  "Panel Advocate": "Advocate",
  Vakil: "Advocate",
  "Principal Advocate": "Managing Partner",
  "Head of Chambers": "Managing Partner",
  Principal: "Managing Partner",
  "Legal Adviser": "Legal Advisor",
  "Legal Researcher": "Research Assistant",
  "Clerk of the Chamber": "Chamber Clerk",
  "Cause List Clerk": "Diary Clerk",
  "Hearing Clerk": "Diary Clerk",
  "Filing Assistant": "Court Clerk",
  "Documentation Officer": "Documentation Assistant",
  "Private Secretary": "Personal Assistant",
  PA: "Personal Assistant",
  "Executive Assistant": "Personal Assistant",
  "Equity Partner": "Partner",
  "Non-Equity Partner": "Partner",
  "Co-Partner": "Partner",
  Founder: "Managing Partner",
  Proprietor: "Managing Partner",
  "Sole Proprietor": "Managing Partner",
  "Admin Executive": "Office Executive",
  "Administrative Executive": "Office Executive",
  "Front Desk Executive": "Receptionist",
  "Front Office Executive": "Receptionist",
  "Telephone Operator": "Receptionist",
  "Legal Intern": "Intern",
  "Law Intern": "Intern",
  AOR: "Advocate on Record",
  "Advocate-on-Record": "Advocate on Record",
  Stenotypist: "Stenographer",
  "Filing Clerk": "Court Clerk",
  "Registry Clerk": "Court Clerk",
  "Billing Clerk": "Accounts Assistant",
  Bookkeeper: "Accounts Assistant",
  "Book Keeper": "Accounts Assistant",
  "Chartered Accountant": "Accounts Manager",
  CA: "Accounts Manager",
  "Data Entry Operator": "Computer Operator",
  "Xerox Operator": "Computer Operator",
  "Photocopy Operator": "Computer Operator",
  "Dak Runner": "Messenger",
  "Court Messenger": "Messenger",
  "Notary Public": "Notary",
  Interpreter: "Translator",
};

/** Designation → default roles prefills on employee create / import. */
export const designationDefaultRoles: Record<Designation, UserRole[]> = {
  // Admin + advocate so chamber head can appear in booking / case assignment lists.
  "Managing Partner": ["admin", "advocate"],
  Partner: ["sub_admin", "advocate"],
  "Senior Advocate": ["advocate"],
  "Advocate on Record": ["advocate"],
  Advocate: ["advocate"],
  Counsel: ["advocate"],
  "Junior Advocate": ["advocate"],
  "Senior Associate": ["advocate"],
  Associate: ["advocate"],
  "Of Counsel": ["advocate"],
  Consultant: ["advocate"],
  "Legal Advisor": ["advocate"],
  Notary: ["advocate"],
  Intern: ["staff"],
  Paralegal: ["staff"],
  "Legal Assistant": ["staff"],
  "Legal Secretary": ["staff"],
  "Personal Assistant": ["staff"],
  "Case Manager": ["staff"],
  "Chamber Clerk": ["staff"],
  "Head Clerk": ["staff"],
  "Senior Clerk": ["staff"],
  "Advocate Clerk": ["staff"],
  "Court Clerk": ["staff"],
  "Diary Clerk": ["staff"],
  Clerk: ["staff"],
  "Research Assistant": ["staff"],
  "Documentation Assistant": ["staff"],
  Translator: ["staff"],
  Stenographer: ["staff"],
  Typist: ["staff"],
  "Law Clerk": ["staff"],
  "Process Server": ["staff"],
  "Office Manager": ["sub_admin"],
  "HR Manager": ["sub_admin"],
  "Office Executive": ["staff"],
  Receptionist: ["staff"],
  "Accounts Manager": ["accountant"],
  Accountant: ["accountant"],
  "Accounts Assistant": ["accountant"],
  Cashier: ["accountant"],
  "Computer Operator": ["staff"],
  Driver: ["staff"],
  Messenger: ["staff"],
  "Office Attendant": ["staff"],
};

export function normalizeDesignation(value: string | null | undefined): Designation | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();
  for (const [alias, target] of Object.entries(LEGACY_DESIGNATION_ALIASES)) {
    if (alias.toLowerCase() === lower) return target;
  }
  for (const d of DESIGNATIONS) {
    if (d.toLowerCase() === lower) return d;
  }
  return undefined;
}

export function isDesignation(value: string): value is Designation {
  return normalizeDesignation(value) !== undefined;
}
