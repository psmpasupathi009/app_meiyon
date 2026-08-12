import { z } from "zod";
import { istDayBounds } from "@/lib/utils/ist";

export const officeTaskKindEnum = z.enum([
  "allotment",
  "finishing",
  "ca_section",
  "bundle_check",
  "numbering",
  "general",
]);

export const officeTaskStatusEnum = z.enum(["open", "done", "cancelled"]);

/** Accept ISO / Date, or YYYY-MM-DD as IST calendar day. */
const optionalDayField = z
  .union([z.string(), z.date(), z.null(), z.literal("")])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    if (v instanceof Date) return v;
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return istDayBounds(s).start;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  })
  .refine(
    (d) => d === undefined || d === null || !Number.isNaN(d.getTime()),
    "Invalid date"
  );

export const createOfficeTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  kind: officeTaskKindEnum.optional().default("general"),
  status: officeTaskStatusEnum.optional().default("open"),
  dueDate: optionalDayField,
  workDate: optionalDayField,
  assigneeUnitId: z.string().trim().optional().or(z.literal("")),
  caseUnitId: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  finishNote: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const updateOfficeTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  kind: officeTaskKindEnum.optional(),
  status: officeTaskStatusEnum.optional(),
  dueDate: optionalDayField,
  workDate: optionalDayField,
  assigneeUnitId: z.string().trim().optional().or(z.literal("")),
  caseUnitId: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  finishNote: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const OFFICE_TASK_KIND_OPTIONS = [
  { value: "allotment", label: "Allotment" },
  { value: "finishing", label: "Finishing" },
  { value: "ca_section", label: "CA section" },
  { value: "bundle_check", label: "Bundle check" },
  { value: "numbering", label: "Numbering" },
  { value: "general", label: "General" },
] as const;

export const OFFICE_TASK_STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

/** CSV import rows — create open tasks only (morning allotment). */
export const importTasksRowSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  workDate: z
    .string()
    .trim()
    .min(1, "workDate is required (YYYY-MM-DD)"),
  assigneeUnitId: optionalText(40),
  caseUnitId: optionalText(40),
  kind: optionalText(40),
});

export const importTasksSchema = z.object({
  dryRun: z.boolean().default(true),
  rows: z.array(importTasksRowSchema).max(500, "Max 500 rows per import"),
});

