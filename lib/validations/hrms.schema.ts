import { z } from "zod";

export const ymdSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const applyLeaveSchema = z
  .object({
    fromDate: ymdSchema,
    toDate: ymdSchema,
    reason: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((d) => d.fromDate <= d.toDate, {
    message: "From date must be on/before to date",
    path: ["toDate"],
  });

export const decideLeaveSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    rejectReason: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .superRefine((d, ctx) => {
    if (d.decision === "rejected" && (d.rejectReason?.trim().length ?? 0) < 3) {
      ctx.addIssue({
        code: "custom",
        message: "Enter at least 3 characters for the reject reason",
        path: ["rejectReason"],
      });
    }
  });

export const checkInOutSchema = z.object({
  notes: z.string().trim().max(300).optional().or(z.literal("")),
  latitude: z.coerce
    .number({ invalid_type_error: "Location is required" })
    .min(-90, "Invalid latitude")
    .max(90, "Invalid latitude"),
  longitude: z.coerce
    .number({ invalid_type_error: "Location is required" })
    .min(-180, "Invalid longitude")
    .max(180, "Invalid longitude"),
  // Drop NaN / Infinity / oversized accuracy instead of failing the punch.
  accuracy: z.preprocess((v) => {
    if (v == null || v === "") return undefined;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 50_000) return undefined;
    return n;
  }, z.number().nonnegative().max(50_000).optional()),
});

export const createOfficeHolidaySchema = z
  .object({
    fromDate: ymdSchema,
    toDate: ymdSchema,
    title: z.string().trim().min(2, "Title is required").max(120),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((d) => d.fromDate <= d.toDate, {
    message: "From date must be on/before to date",
    path: ["toDate"],
  });

export const updateOfficeHolidaySchema = z
  .object({
    fromDate: ymdSchema.optional(),
    toDate: ymdSchema.optional(),
    title: z.string().trim().min(2).max(120).optional(),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .superRefine((d, ctx) => {
    if (d.fromDate && d.toDate && d.fromDate > d.toDate) {
      ctx.addIssue({
        code: "custom",
        message: "From date must be on/before to date",
        path: ["toDate"],
      });
    }
  });
