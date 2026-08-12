import { z } from "zod";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_MODES,
} from "@/features/expenses/lib/categories";
import { parseIstDateInput } from "@/lib/utils/ist";

export const expenseCategoryEnum = z.enum(EXPENSE_CATEGORIES);
export const expensePaymentModeEnum = z.enum(EXPENSE_PAYMENT_MODES);

const dateStringOrDate = z
  .union([z.string(), z.date()])
  .transform((v) => parseIstDateInput(v))
  .refine((d): d is Date => d != null, "Invalid date");

/** Empty / missing payment mode → cash (FormData often sends ""). */
const paymentModeField = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? "cash" : v),
  expensePaymentModeEnum
);

/** Fields shared by JSON update and multipart create (without file). */
export const expenseFieldsSchema = z
  .object({
    expenseDate: dateStringOrDate,
    category: expenseCategoryEnum,
    vendor: z.string().trim().max(160).optional().or(z.literal("")),
    description: z.string().trim().min(1, "Description is required").max(1000),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    paymentMode: paymentModeField,
  })
  .superRefine((data, ctx) => {
    if (
      (data.category === "others" || data.category === "misc") &&
      data.description.trim().length < 3
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add a short note describing this expense",
        path: ["description"],
      });
    }
  });

export const createExpenseFieldsSchema = expenseFieldsSchema;

export const updateExpenseSchema = z
  .object({
    expenseDate: dateStringOrDate.optional(),
    category: expenseCategoryEnum.optional(),
    vendor: z.string().trim().max(160).optional().or(z.literal("")),
    description: z
      .string()
      .trim()
      .min(1, "Description is required")
      .max(1000)
      .optional(),
    amount: z.coerce
      .number()
      .positive("Amount must be greater than 0")
      .optional(),
    paymentMode: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      expensePaymentModeEnum.optional()
    ),
  })
  .superRefine((data, ctx) => {
    if (
      data.category &&
      (data.category === "others" || data.category === "misc") &&
      data.description !== undefined &&
      data.description.trim().length < 3
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add a short note describing this expense",
        path: ["description"],
      });
    }
  });

export const voidExpenseSchema = z.object({
  reason: z.string().trim().min(1, "Reason is required").max(500),
});
