import { z } from "zod";
import { PAYMENT_PURPOSES } from "@/features/accounts/lib/payment-purposes";
import { parseIstDateInput } from "@/lib/utils/ist";

export const paymentTypeEnum = z.enum(PAYMENT_PURPOSES);
export const paymentStatusEnum = z.enum(["pending", "paid", "void"]);
/** Create/update never set void — use the void endpoint. */
export const writablePaymentStatusEnum = z.enum(["pending", "paid"]);

const dateStringOrDate = z
  .union([z.string(), z.date()])
  .transform((v) => parseIstDateInput(v))
  .refine((d): d is Date => d != null, "Invalid date");

/** Allow clearing paidOn with null or "". */
const paidOnField = z
  .union([dateStringOrDate, z.null(), z.literal("")])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    return v;
  });

export const createPaymentSchema = z
  .object({
    clientUnitId: z.string().trim().min(1, "Client is required"),
    caseUnitId: z.string().trim().optional().or(z.literal("")),
    type: paymentTypeEnum,
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    status: writablePaymentStatusEnum.optional(),
    paidOn: paidOnField,
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.type === "other" && !data.notes?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Notes are required for Other purpose",
        path: ["notes"],
      });
    }
    const status = data.status ?? "pending";
    if (status === "paid" && !data.paidOn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Paid on date is required when status is paid",
        path: ["paidOn"],
      });
    }
  });

export const updatePaymentSchema = z
  .object({
    type: paymentTypeEnum.optional(),
    amount: z.coerce.number().positive().optional(),
    status: writablePaymentStatusEnum.optional(),
    paidOn: paidOnField,
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.type === "other" && data.notes !== undefined && !data.notes.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Notes are required for Other purpose",
        path: ["notes"],
      });
    }
  });

export const voidPaymentSchema = z.object({
  reason: z.string().trim().min(1, "Reason is required").max(500),
});

export const importPaymentsRowSchema = z.object({
  clientUnitId: z.string().trim().min(1, "clientUnitId is required"),
  caseUnitId: z.string().trim().optional().or(z.literal("")),
  type: z.string().trim(),
  amount: z.string().trim(),
  status: z.string().trim().optional().or(z.literal("")),
  paidOn: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

export const importPaymentsSchema = z.object({
  dryRun: z.boolean().default(true),
  rows: z.array(importPaymentsRowSchema).max(500, "Max 500 rows per import"),
});
