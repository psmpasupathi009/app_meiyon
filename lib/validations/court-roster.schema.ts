import { z } from "zod";

const istDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const courtFields = {
  state: z.string().trim().min(1).max(80),
  district: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(80),
  courtName: z.string().trim().min(1).max(160),
};

export const createCourtDutyOverrideSchema = z
  .object({
    ...courtFields,
    advocateUnitId: z.string().trim().min(1),
    fromDate: istDate,
    toDate: istDate,
    reason: z.string().trim().max(300).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.fromDate > data.toDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toDate"],
        message: "End date must be on or after start date",
      });
    }
  });

export const updateCourtDutyOverrideSchema = z
  .object({
    advocateUnitId: z.string().trim().min(1).optional(),
    fromDate: istDate.optional(),
    toDate: istDate.optional(),
    reason: z.string().trim().max(300).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.fromDate && data.toDate && data.fromDate > data.toDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toDate"],
        message: "End date must be on or after start date",
      });
    }
  });

export const permanentCourtAssignSchema = z.object({
  advocateUnitId: z.string().trim().min(1),
  action: z.enum(["add", "remove"]),
  ...courtFields,
});
